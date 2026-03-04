// ai-symptom-model.js
const natural = require('natural');

class AISymptomClassifier {
    constructor() {
        this.tokenizer = new natural.WordTokenizer();
        this.classifier = new natural.BayesClassifier();
        this.isTrained = false;
        
        // Enhanced training dataset
        this.trainingData = this.generateTrainingData();
        this.initializeModel();
    }

    generateTrainingData() {
        return [
            // Emergency/Critical symptoms (Severe)
            { text: "chest pain radiating to left arm and jaw", category: "critical" },
            { text: "difficulty breathing cannot catch breath", category: "critical" },
            { text: "severe bleeding from arterial wound", category: "critical" },
            { text: "unconscious not responding to stimuli", category: "critical" },
            { text: "heart attack symptoms with sweating", category: "critical" },
            { text: "stroke symptoms facial drooping arm weakness", category: "critical" },
            { text: "severe allergic reaction throat swelling", category: "critical" },
            { text: "compound fracture bone visible", category: "critical" },
            { text: "third degree burns charred skin", category: "critical" },
            { text: "poisoning from chemical ingestion", category: "critical" },
            { text: "seizure convulsions lasting minutes", category: "critical" },
            { text: "sudden paralysis one side body", category: "critical" },
            { text: "severe head injury with confusion", category: "critical" },
            { text: "electric shock with burns", category: "critical" },
            { text: "drowning incident near fatal", category: "critical" },

            // Urgent symptoms
            { text: "high fever with body aches", category: "urgent" },
            { text: "severe abdominal pain vomiting", category: "urgent" },
            { text: "deep cut requiring stitches", category: "urgent" },
            { text: "broken finger with deformity", category: "urgent" },
            { text: "asthma attack with wheezing", category: "urgent" },
            { text: "migraine with visual disturbances", category: "urgent" },
            { text: "kidney stone pain severe", category: "urgent" },
            { text: "eye injury with vision loss", category: "urgent" },
            { text: "high fever over 103 degrees", category: "urgent" },
            { text: "severe dehydration", category: "urgent" },

            // Moderate symptoms
            { text: "persistent cough with phlegm", category: "moderate" },
            { text: "ear infection with pain", category: "moderate" },
            { text: "urinary tract infection", category: "moderate" },
            { text: "sinus infection pressure", category: "moderate" },
            { text: "back pain that persists", category: "moderate" },
            { text: "mild asthma symptoms", category: "moderate" },
            { text: "skin infection spreading", category: "moderate" },
            { text: "sprained ankle swelling", category: "moderate" },

            // Mild symptoms
            { text: "mild headache tension type", category: "mild" },
            { text: "common cold runny nose", category: "mild" },
            { text: "minor cut superficial wound", category: "mild" },
            { text: "mild fever 99 degrees", category: "mild" },
            { text: "sore throat without fever", category: "mild" },
            { text: "stomach ache mild discomfort", category: "mild" },
            { text: "back pain chronic mild", category: "mild" },
            { text: "skin rash itching mild", category: "mild" },
            { text: "muscle soreness after exercise", category: "mild" },
            { text: "fatigue general tiredness", category: "mild" },
            { text: "insomnia difficulty sleeping", category: "mild" },
            { text: "mild anxiety stress", category: "mild" },
            { text: "seasonal allergies sneezing", category: "mild" },
            { text: "mild sunburn redness", category: "mild" },
            { text: "bruise from minor injury", category: "mild" }
        ];
    }

    initializeModel() {
        console.log('🤖 Initializing AI symptom classifier...');
        this.trainModel();
    }

    trainModel() {
        try {
            console.log('🤖 Training AI symptom classifier with Natural NLP...');
            
            // Train the classifier
            this.trainingData.forEach(item => {
                this.classifier.addDocument(item.text, item.category);
            });
            
            this.classifier.train();
            this.isTrained = true;
            
            console.log('✅ AI symptom classifier training completed!');
            console.log(`📊 Training data: ${this.trainingData.length} samples`);
            
            // Test the classifier
            this.evaluateModel();
            
        } catch (error) {
            console.error('❌ Error training model:', error);
            this.isTrained = false;
        }
    }

    async predictSeverity(symptoms) {
        if (!this.isTrained) {
            console.log('⚠️  AI model not trained, using rule-based fallback');
            return this.ruleBasedFallback(symptoms);
        }

        try {
            const classification = this.classifier.classify(symptoms);
            const probabilities = this.classifier.getClassifications(symptoms);
            
            // Calculate confidence and severity score
            const topCategory = probabilities[0];
            const confidence = topCategory.value;
            const severityScore = this.categoryToScore(classification);
            const isSevere = classification === 'critical' || classification === 'urgent';

            console.log(`🔍 AI Prediction - Symptoms: "${symptoms.substring(0, 50)}..." -> ${classification} (confidence: ${confidence.toFixed(3)})`);

            return {
                severityScore: severityScore,
                isSevere: isSevere,
                confidence: confidence,
                category: classification,
                probabilities: probabilities,
                method: 'ai-nlp'
            };

        } catch (error) {
            console.error('❌ AI prediction error:', error);
            return this.ruleBasedFallback(symptoms);
        }
    }

    categoryToScore(category) {
        const scores = {
            'critical': 0.95,
            'urgent': 0.75,
            'moderate': 0.45,
            'mild': 0.15
        };
        return scores[category] || 0.3;
    }

    ruleBasedFallback(symptoms) {
        // Enhanced rule-based system with multiple severity levels
        const criticalKeywords = [
            'chest pain', 'heart attack', 'stroke', 'severe bleeding', 'unconscious',
            'difficulty breathing', 'choking', 'cardiac arrest', 'not breathing',
            'seizure', 'paralysis', 'anaphylaxis', 'compound fracture'
        ];
        
        const urgentKeywords = [
            'broken bone', 'severe pain', 'high fever', 'deep cut', 'severe burn',
            'head injury', 'fainting', 'poisoning', 'allergic reaction',
            'asthma attack', 'migraine', 'kidney stone'
        ];
        
        const moderateKeywords = [
            'fever', 'infection', 'persistent cough', 'ear pain', 'uti',
            'sinus', 'back pain', 'sprain', 'rash spreading'
        ];
        
        const symptomsLower = symptoms.toLowerCase();
        
        let category = 'mild';
        if (criticalKeywords.some(keyword => symptomsLower.includes(keyword))) {
            category = 'critical';
        } else if (urgentKeywords.some(keyword => symptomsLower.includes(keyword))) {
            category = 'urgent';
        } else if (moderateKeywords.some(keyword => symptomsLower.includes(keyword))) {
            category = 'moderate';
        }
        
        const severityScore = this.categoryToScore(category);
        
        return {
            severityScore: severityScore,
            isSevere: category === 'critical' || category === 'urgent',
            confidence: 0.85,
            category: category,
            method: 'rule-based'
        };
    }

    evaluateModel() {
        if (!this.isTrained) return null;

        const testCases = [
            { symptoms: "mild headache and tiredness", expected: "mild" },
            { symptoms: "chest pain with sweating and arm pain", expected: "critical" },
            { symptoms: "minor cut on finger", expected: "mild" },
            { symptoms: "difficulty breathing and blue lips", expected: "critical" },
            { symptoms: "high fever with body aches", expected: "urgent" },
            { symptoms: "broken arm with bone visible", expected: "critical" }
        ];

        console.log('\n🧪 Model Evaluation:');
        let correct = 0;
        
        testCases.forEach(test => {
            const prediction = this.classifier.classify(test.symptoms);
            const isCorrect = prediction === test.expected;
            if (isCorrect) correct++;
            
            console.log(`"${test.symptoms}" -> ${prediction} (expected: ${test.expected}) ${isCorrect ? '✅' : '❌'}`);
        });
        
        const accuracy = (correct / testCases.length * 100).toFixed(1);
        console.log(`📊 Test Accuracy: ${accuracy}%`);
    }

    // Method to get similar cases for explainable AI
    getSimilarCases(symptoms, limit = 3) {
        if (!this.isTrained) return [];
        
        const symptomsLower = symptoms.toLowerCase();
        const similarCases = this.trainingData
            .filter(case_ => {
                const caseLower = case_.text.toLowerCase();
                // Simple similarity check - in production, use proper similarity algorithms
                return caseLower.includes(symptomsLower) || symptomsLower.includes(caseLower);
            })
            .slice(0, limit);
            
        return similarCases;
    }
}

module.exports = AISymptomClassifier;