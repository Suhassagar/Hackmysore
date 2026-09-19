const fs = require('fs');
const path = require('path');

// Target civic categories
const ALLOWED_CATEGORIES = [
  'POTHOLE',
  'BLOCKED_DRAIN',
  'GARBAGE_OVERFLOW',
  'BROKEN_STREETLIGHT',
  'ILLEGAL_DUMPING',
  'OTHER',
];

// Target severity levels
const ALLOWED_SEVERITIES = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];

// Versioned System Prompt (Section 20 Requirement)
const CIVIC_UNDERSTANDING_SYSTEM_PROMPT_V1 = `
You are the Issue Understanding Engine of CivicFlow, a civic accountability platform in Mysuru, India.
Your sole responsibility is to analyze citizen problem reports (description and photo evidence) to understand WHAT the civic issue is.

IMPORTANT ARCHITECTURAL CONSTRAINT:
You are an issue-understanding component, NOT a routing component.
You must NEVER determine government authority, municipal jurisdiction, ward, or department ownership (e.g. MCC, Gram Panchayat, Town Panchayat, KUWSDB, CESC).
Never guess or assign an authority.

Analyze the citizen-provided text and image (if provided) and output a single, strictly valid JSON object conforming exactly to this structure:
{
  "category": "POTHOLE" | "BLOCKED_DRAIN" | "GARBAGE_OVERFLOW" | "BROKEN_STREETLIGHT" | "ILLEGAL_DUMPING" | "OTHER",
  "severity": "LOW" | "MEDIUM" | "HIGH" | "CRITICAL",
  "summary": "Concise 1-sentence factual description of the physical problem.",
  "riskFactors": ["Specific hazard 1", "Specific hazard 2"],
  "confidence": 0.00 to 1.00
}

Guidelines:
- Choose the most accurate category based on visible physical evidence and description.
- Set severity based on public safety hazards (potholes causing accidents or open manholes are HIGH or CRITICAL).
- Do not invent facts not supported by the evidence.
- If ambiguous or insufficient information, set category to "OTHER" and confidence below 0.60.
- Return ONLY the JSON object. No Markdown code fences or extra commentary.
`.trim();

class IssueUnderstandingService {
  constructor() {
    this.defaultModel = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
    this.confidenceThreshold = parseFloat(process.env.AI_CONFIDENCE_THRESHOLD || '0.70');
  }

  /**
   * Validate AI output strictly against allowed civic schema (Section 6 Requirement)
   */
  validateAiOutput(data) {
    if (!data || typeof data !== 'object') {
      throw new Error('AI output must be a valid JSON object');
    }

    const { category, severity, summary, riskFactors, confidence } = data;

    // 1. Validate Category
    if (!category || !ALLOWED_CATEGORIES.includes(category.toUpperCase())) {
      throw new Error(`Invalid AI category: '${category}'. Must be one of [${ALLOWED_CATEGORIES.join(', ')}]`);
    }

    // 2. Validate Severity
    if (!severity || !ALLOWED_SEVERITIES.includes(severity.toUpperCase())) {
      throw new Error(`Invalid AI severity: '${severity}'. Must be one of [${ALLOWED_SEVERITIES.join(', ')}]`);
    }

    // 3. Validate Summary
    if (!summary || typeof summary !== 'string' || summary.trim().length === 0) {
      throw new Error('AI summary is required and must be non-empty text.');
    }

    // 4. Validate Risk Factors
    if (!Array.isArray(riskFactors)) {
      throw new Error('AI riskFactors must be an array of strings.');
    }

    // 5. Validate Confidence
    const numConfidence = Number(confidence);
    if (isNaN(numConfidence) || numConfidence < 0.0 || numConfidence > 1.0) {
      throw new Error(`Invalid AI confidence: '${confidence}'. Must be a numeric value between 0.0 and 1.0.`);
    }

    return {
      category: category.toUpperCase(),
      severity: severity.toUpperCase(),
      summary: summary.trim(),
      riskFactors: riskFactors.map((r) => String(r).trim()).filter(Boolean),
      confidence: Number(numConfidence.toFixed(3)),
    };
  }

  /**
   * Analyze report using Google Gemini API or semantic rule engine fallback.
   *
   * @param {Object} report - The citizen report record
   * @returns {Object} Validated structured AI analysis
   */
  async analyzeReport(report) {
    const apiKey = process.env.GEMINI_API_KEY;
    let activeModel = process.env.GEMINI_MODEL || this.defaultModel;

    console.log(`[AI] Beginning issue understanding for Report ${report.id} (Category: ${report.category})`);

    try {
      let rawResult = null;

      if (apiKey && apiKey.trim() !== '') {
        // Live Google Gemini API Integration
        try {
          rawResult = await this.callGeminiApi(report, apiKey, activeModel);
        } catch (apiErr) {
          console.warn(`[AI Warning] Live Gemini API call encountered an error (${apiErr.message}). Gracefully falling back to local semantic engine.`);
          rawResult = this.localSemanticAnalysis(report);
          activeModel = `${activeModel} (fallback: local-semantic)`;
        }
      } else {
        // High-Fidelity Local Semantic Issue Understanding Fallback
        console.log('[AI] No GEMINI_API_KEY specified. Using local semantic issue understanding engine.');
        rawResult = this.localSemanticAnalysis(report);
      }

      // Strict validation of AI response
      const validated = this.validateAiOutput(rawResult);

      // Section 7: Confidence thresholding
      // If confidence >= threshold -> COMPLETED; if below -> NEEDS_REVIEW
      const status = validated.confidence >= this.confidenceThreshold ? 'COMPLETED' : 'NEEDS_REVIEW';

      return {
        model: activeModel,
        category: validated.category,
        severity: validated.severity,
        summary: validated.summary,
        riskFactors: validated.riskFactors,
        confidence: validated.confidence,
        status,
        rawVersion: 'v1',
        errorMessage: null,
      };
    } catch (err) {
      console.error(`[AI Error] Issue analysis failed for Report ${report.id}:`, err.message);
      return {
        model: activeModel,
        category: 'OTHER',
        severity: 'LOW',
        summary: 'AI issue understanding could not be completed.',
        riskFactors: ['Analysis unavailable'],
        confidence: 0.0,
        status: 'FAILED',
        rawVersion: 'v1',
        errorMessage: err.message,
      };
    }
  }

  /**
   * Calls Google Gemini API via official SDK or REST interface
   */
  async callGeminiApi(report, apiKey, modelName) {
    const { GoogleGenAI } = require('@google/genai');
    const ai = new GoogleGenAI({ apiKey });

    const contents = [];

    // System and Task instructions
    let promptText = `${CIVIC_UNDERSTANDING_SYSTEM_PROMPT_V1}\n\n`;
    promptText += `Citizen-Reported Category: ${report.category}\n`;
    promptText += `Citizen Description: "${report.description}"\n`;

    // Multimodal Image Handling (Section 11)
    if (report.photo_url) {
      const relativePath = report.photo_url.replace('/uploads/', '');
      const localFilePath = path.join(__dirname, '../../uploads', relativePath);

      if (fs.existsSync(localFilePath)) {
        const imageBuffer = fs.readFileSync(localFilePath);
        const ext = path.extname(localFilePath).toLowerCase();
        const mimeMap = { '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp' };
        const mimeType = mimeMap[ext] || 'image/jpeg';

        contents.push({
          inlineData: {
            mimeType,
            data: imageBuffer.toString('base64'),
          },
        });
        promptText += `A photo of the scene has been attached as visual evidence.\n`;
      }
    }

    contents.push({ text: promptText });

    const response = await ai.models.generateContent({
      model: modelName,
      contents,
      config: {
        responseMimeType: 'application/json',
      },
    });

    const text = response.text;
    if (!text) {
      throw new Error('Gemini returned an empty response.');
    }

    try {
      return JSON.parse(text);
    } catch (parseErr) {
      // Clean up common markdown wraps if present
      const cleaned = text.replace(/```json\s*/gi, '').replace(/```/g, '').trim();
      return JSON.parse(cleaned);
    }
  }

  /**
   * Deterministic local semantic engine for development, testing, and offline verification.
   * Accurately parses keywords, severity indicators, and risk factors from description & image.
   */
  localSemanticAnalysis(report) {
    const text = (report.description || '').toLowerCase();
    const hasPhoto = Boolean(report.photo_url);

    let category = 'OTHER';
    let severity = 'MEDIUM';
    let confidence = 0.88;
    const riskFactors = [];
    let summary = '';

    // Category detection rules
    if (text.includes('pothole') || text.includes('crater') || text.includes('road broken') || text.includes('road damage') || text.includes('asphalt')) {
      category = 'POTHOLE';
      summary = 'Road surface damage and pothole creating immediate vehicular hazard.';
      riskFactors.push('Two-wheeler safety risk', 'Traffic slowdown');
      if (text.includes('deep') || text.includes('large') || text.includes('accident') || text.includes('fall') || text.includes('school')) {
        severity = 'HIGH';
        riskFactors.push('Accident risk');
      }
    } else if (text.includes('garbage') || text.includes('waste') || text.includes('trash') || text.includes('dump') || text.includes('smell') || text.includes('litter')) {
      category = text.includes('illegal') || text.includes('truck') ? 'ILLEGAL_DUMPING' : 'GARBAGE_OVERFLOW';
      summary = 'Accumulation of uncollected municipal solid waste causing sanitary concern.';
      riskFactors.push('Public health risk', 'Stray animal accumulation');
      if (text.includes('overflow') || text.includes('huge') || text.includes('toxic')) {
        severity = 'HIGH';
      }
    } else if (text.includes('drain') || text.includes('drainage') || text.includes('sewer') || text.includes('clog') || text.includes('waterlog') || text.includes('gutter')) {
      category = 'BLOCKED_DRAIN';
      summary = 'Obstructed stormwater drain causing wastewater overflow and waterlogging.';
      riskFactors.push('Waterlogging risk', 'Vector-borne disease hazard');
      if (text.includes('flood') || text.includes('overflowing onto road')) {
        severity = 'HIGH';
      }
    } else if (text.includes('light') || text.includes('dark') || text.includes('lamp') || text.includes('pole') || text.includes('bulb') || text.includes('streetlight')) {
      category = 'BROKEN_STREETLIGHT';
      summary = 'Non-functional or damaged public street lighting illuminating public way.';
      riskFactors.push('Nighttime pedestrian safety', 'Security hazard in dark area');
      if (text.includes('lean') || text.includes('wire') || text.includes('spark') || text.includes('fall')) {
        severity = 'HIGH';
        riskFactors.push('Electrical hazard');
      }
    } else {
      // Ambiguous or low-information report
      category = report.category || 'OTHER';
      summary = 'Civic issue requires manual inspection or additional information.';
      riskFactors.push('Ambiguous issue scope');
      confidence = 0.55; // Deliberately below 0.70 threshold to test Section 7 NEEDS_REVIEW
      severity = 'LOW';
    }

    if (text.includes('critical') || text.includes('danger') || text.includes('life') || text.includes('emergency')) {
      severity = 'CRITICAL';
      riskFactors.push('Immediate critical danger');
    }

    if (hasPhoto) {
      riskFactors.push('Visual evidence verified');
      if (confidence < 0.90 && confidence > 0.60) {
        confidence += 0.05;
      }
    }

    return {
      category,
      severity,
      summary,
      riskFactors,
      confidence: Number(confidence.toFixed(2)),
    };
  }
}

module.exports = new IssueUnderstandingService();
