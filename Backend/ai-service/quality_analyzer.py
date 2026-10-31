import re
import difflib
from datetime import datetime

COMMON_WORDS = {
    'the', 'be', 'to', 'of', 'and', 'a', 'in', 'that', 'have', 'i', 'it',
    'for', 'not', 'on', 'with', 'he', 'as', 'you', 'do', 'at', 'this',
    'but', 'his', 'by', 'from', 'they', 'we', 'say', 'her', 'she', 'or',
    'an', 'will', 'my', 'one', 'all', 'would', 'there', 'their', 'what',
    'so', 'up', 'out', 'if', 'about', 'who', 'get', 'which', 'go', 'me',
    'when', 'make', 'can', 'like', 'time', 'no', 'just', 'him', 'know',
    'take', 'people', 'into', 'year', 'your', 'good', 'some', 'could',
    'them', 'see', 'other', 'than', 'then', 'now', 'look', 'only', 'come',
    'its', 'over', 'think', 'also', 'back', 'after', 'use', 'two', 'how',
    'our', 'work', 'first', 'well', 'way', 'even', 'new', 'want',
    'because', 'any', 'these', 'give', 'day', 'most', 'us', 'project',
    'system', 'application', 'web', 'mobile', 'data', 'ai', 'machine',
    'learning', 'management', 'portal', 'student', 'teacher',
    'university', 'college', 'fyp', 'final', 'development', 'design',
    'implement', 'analysis', 'research', 'study', 'really', 'wanted',
    'sync', 'based', 'features', 'contains'
}

def is_meaningful_word(word):
    word = word.lower().strip('.,!?;:"\'()[]{}')

    if len(word) < 2:
        return False, "word too short"
    if re.match(r'^[0-9]+$', word):
        return False, "numbers only"
    if len(set(word)) == 1:
        return False, "repetitive letters"
    
    has_vowel = any(v in word for v in "aeiou")
    if not has_vowel and len(word) > 2:
        return False, "no vowels"

    if word in COMMON_WORDS:
        return True, "common word"
    if len(word) >= 4 and len(set(word)) > 2:
        return True, "likely meaningful"

    return False, "unclear word"

def find_closest_word(word, common_words_set):
    word = word.lower()
    if word in common_words_set:
        return None

    best_match = None
    best_score = 0

    for common in common_words_set:
        if len(common) < 3:
            continue
        if abs(len(word) - len(common)) > 2:
            continue

        similarity = difflib.SequenceMatcher(None, word, common).ratio()
        if similarity > 0.75 and similarity > best_score:
            best_score = similarity
            best_match = common

    if best_score > 0.8:
        return best_match
    return None

def check_spelling_auto(text):
    words = re.findall(r'[a-zA-Z]+', text.lower())
    mistakes = []

    for word in words:
        if word in COMMON_WORDS:
            continue
        if len(word) < 3:
            continue

        is_meaningful, _ = is_meaningful_word(word)
        if is_meaningful:
            continue

        closest = find_closest_word(word, COMMON_WORDS)
        if closest:
            mistakes.append((word, closest))
        elif len(word) > 3 and not is_meaningful:
            mistakes.append((word, None))

    return mistakes

def check_idea_quality(title, description):
    feedback = []
    score = 10

    # Check title length
    words_in_title = title.split()
    if len(words_in_title) < 2:
        feedback.append("Title is too short, add more words")
        score -= 2
    elif len(words_in_title) > 12:
        feedback.append("Title is too long, make it concise")
        score -= 1
    else:
        feedback.append("Title length is good")

    # Check description length
    words_in_description = description.split()
    word_count = len(words_in_description)

    if word_count < 10:
        feedback.append("Description is too short, needs more details")
        score -= 3
    elif word_count < 30:
        feedback.append("Description could be more detailed")
        score -= 1
    else:
        feedback.append("Description has good detail")

    # Check spelling
    spelling_mistakes = check_spelling_auto(description)
    mistake_text = []

    for word, suggestion in spelling_mistakes[:3]:
        if suggestion:
            mistake_text.append(f"'{word}' -> '{suggestion}'")
        else:
            mistake_text.append(f"'{word}'")

    if spelling_mistakes:
        feedback.append("Spelling mistakes found: " + ", ".join(mistake_text))
        score -= 1

    # Check vague words
    vague_words = ['thing', 'stuff', 'something', 'various', 'etc']
    description_lower = description.lower()
    vague_found = []

    for w in description_lower.split():
        if w in vague_words:
            vague_found.append(w)

    if vague_found:
        feedback.append("Avoid vague words like: " + ", ".join(vague_found))
        score -= 1

    if score < 0:
        score = 0

    return {
        'score': score,
        'feedback': feedback,
        'word_count': word_count,
        'spelling_mistakes': spelling_mistakes,
        'status': 'Good' if score >= 7 else 'Needs Improvement'
    }

def check_title_quality(title):
    feedback = []
    score = 10

    words_in_title = title.split()

    if len(words_in_title) < 2:
        feedback.append("Title too short, less than 2 words")
        score = score - 2
    elif len(words_in_title) > 10:
        feedback.append("Title too long, more than 10 words")
        score = score - 1
    else:
        feedback.append("Title length is appropriate")

    generic_words = ['system', 'application', 'project', 'management', 'portal']
    title_lower = title.lower()
    generic_found = []

    for g in generic_words:
        if g in title_lower:
            generic_found.append(g)

    if generic_found:
        feedback.append("Avoid generic words like: " + ', '.join(generic_found[:2]))
        score = score - 1

    spelling_mistakes = check_spelling_auto(title)

    if spelling_mistakes:
        mistake_text = []
        for word, suggestion in spelling_mistakes[:2]:
            if suggestion:
                mistake_text.append("'" + word + "' -> '" + suggestion + "'")
            else:
                mistake_text.append("'" + word + "'")
        feedback.append("Spelling mistakes: " + ', '.join(mistake_text))
        score = score - 1

    if score < 0:
        score = 0

    return {
        'score': score,
        'feedback': feedback,
        'status': 'Good' if score >= 7 else 'Needs Improvement'
    }

def check_similarity(title, description, existing_ideas):
    feedback = []
    content = (title + " " + description).lower()
    matches = []

    for existing in existing_ideas:
        existing_lower = existing.lower()
        if title.lower() == existing_lower:
            matches.append({
                'idea': existing,
                'match': "100%",
                'type': "exact"
            })
        else:
            similarity = difflib.SequenceMatcher(None, content, existing_lower).ratio()
            match_percentage = int(similarity * 100)
            if match_percentage > 50:
                matches.append({
                    'idea': existing,
                    'match': str(match_percentage) + "%",
                    'type': "partial"
                })

    matches.sort(
        key=lambda x: int(x['match'].replace('%', '')),
        reverse=True
    )

    if matches:
        feedback.append("Similar idea found with " + matches[0]['match'] + " match")
        feedback.append("Similar to: " + matches[0]['idea'][:100])
        if matches[0]['type'] == "exact":
            feedback.append("WARNING: This appears to be an exact duplicate")
    else:
        feedback.append("No duplicate ideas found")

    return {
        'has_duplicate': len(matches) > 0,
        'matches': matches,
        'feedback': feedback,
        'status': 'Clean' if len(matches) == 0 else 'Duplicate Found'
    }

def check_domain_match(title, description, selected_domain):
    domain_keywords = {
        'AI/ML': [
            'machine learning', 'artificial intelligence', 'ai', 'ml',
            'model', 'training', 'prediction', 'classification', 'neural'
        ],
        'Web Development': [
            'web', 'website', 'application', 'app', 'api',
            'database', 'frontend', 'backend', 'react', 'django'
        ],
        'Mobile Development': [
            'mobile', 'android', 'ios', 'app',
            'flutter', 'react native', 'kotlin', 'swift'
        ],
        'Cybersecurity': [
            'security', 'cyber', 'encryption', 'authentication',
            'vulnerability', 'privacy', 'firewall', 'threat'
        ],
        'Data Science': [
            'data', 'analytics', 'visualization', 'statistics',
            'dashboard', 'big data', 'analysis', 'mining'
        ]
    }

    keywords = domain_keywords.get(selected_domain, [])
    content = (title + " " + description).lower()

    matched_keywords = []
    for kw in keywords:
        if kw in content:
            matched_keywords.append(kw)

    feedback = []
    if matched_keywords:
        feedback.append("Project matches '" + selected_domain + "' domain")
        feedback.append("Found keywords: " + ', '.join(matched_keywords[:3]))
    else:
        feedback.append("Project does not match '" + selected_domain + "' domain")
        feedback.append("Suggested keywords: " + ', '.join(keywords[:5]))

    return {
        'is_match': len(matched_keywords) >= 1,
        'matched_keywords': matched_keywords,
        'feedback': feedback,
        'status': 'Matched' if len(matched_keywords) >= 1 else 'Mismatch'
    }

def analyze_document_structure(document_text):
    if not document_text:
        return {
            'found': [],
            'missing': ['problem statement', 'objectives', 'methodology', 'introduction'],
            'completeness': 0,
            'feedback': ["No document uploaded"],
            'status': 'No Document'
        }

    required_sections = [
        'problem statement',
        'objectives',
        'methodology',
        'introduction'
    ]

    document_lower = document_text.lower()
    found = []
    missing = []

    for section in required_sections:
        if section in document_lower:
            found.append(section)
        else:
            missing.append(section)

    completeness = (len(found) / len(required_sections)) * 100

    feedback = []
    if missing:
        feedback.append("Missing sections: " + ', '.join(missing))
    else:
        feedback.append("All required sections present")

    return {
        'found': found,
        'missing': missing,
        'completeness': completeness,
        'feedback': feedback,
        'status': 'Complete' if completeness == 100 else 'Incomplete'
    }

def check_content_quality(text):
    if not text:
        return {
            'word_count': 0,
            'sentence_count': 0,
            'score': 0,
            'feedback': ["No document uploaded"],
            'status': 'No Document'
        }

    words = text.split()
    word_count = len(words)

    sentences = re.split(r'[.!?]+', text)
    sentence_count = sum(1 for s in sentences if len(s.strip()) > 0)

    feedback = []
    score = 10

    if word_count < 100:
        feedback.append("Content too short, incomplete")
        score -= 4
    elif word_count < 250:
        feedback.append("Content could be more detailed")
        score -= 2
    else:
        feedback.append("Content length is good")

    if sentence_count < 5:
        feedback.append("Too few sentences, content incomplete")
        score -= 3
    elif sentence_count < 10:
        feedback.append("Add more sentences for clarity")
        score -= 1

    spelling_mistakes = check_spelling_auto(text)

    if spelling_mistakes:
        feedback.append("Spelling mistakes found")
        score -= 1

    if score < 0:
        score = 0

    return {
        'word_count': word_count,
        'sentence_count': sentence_count,
        'score': score,
        'feedback': feedback,
        'status': 'Good' if score >= 7 else 'Needs Improvement'
    }

def check_grammar(text):
    if not text:
        return {
            'issues': ["No document uploaded"],
            'issue_count': 1,
            'status': 'No Document'
        }

    issues = []
    sentences = re.split(r'[.!?]+', text)
    sentences = [s.strip() for s in sentences if s.strip()]

    # Check 1: Sentences not starting with capital letter
    lowercase_start_count = sum(1 for sent in sentences if sent and sent[0].islower())
    if lowercase_start_count > 0:
        issues.append(f"{lowercase_start_count} sentence(s) not starting with a capital letter")

    # Check 2: Long sentences
    long_sentence_count = sum(1 for sent in sentences if len(sent.split()) > 35)
    if long_sentence_count > 0:
        issues.append(f"{long_sentence_count} long sentence(s) detected, consider breaking them up")

    # Check 3: Double spaces
    double_space_count = len(re.findall(r'  +', text))
    if double_space_count > 0:
        issues.append(f"{double_space_count} instance(s) of extra/double spaces found")

    return {
        'issues': issues[:5],
        'issue_count': len(issues),
        'status': 'Clean' if len(issues) == 0 else 'Issues Found'
    }

def check_deadline(submission_date, deadline_date):
    if not submission_date or not deadline_date:
        return {'status': 'UNKNOWN', 'message': 'Dates not provided', 'risk': 'Low'}
    
    if submission_date > deadline_date:
        days_late = (submission_date - deadline_date).days
        return {
            'status': 'LATE',
            'message': str(days_late) + " days past deadline",
            'risk': 'High'
        }
    else:
        days_left = (deadline_date - submission_date).days
        if days_left <= 3:
            return {'status': 'URGENT', 'message': str(days_left) + " days left", 'risk': 'High'}
        elif days_left <= 7:
            return {'status': 'WARNING', 'message': str(days_left) + " days left", 'risk': 'Medium'}
        else:
            return {'status': 'ON TIME', 'message': str(days_left) + " days left", 'risk': 'Low'}

def predict_progress(student_data):
    risk_score = 0
    risks = []
    
    if not student_data:
        return {'level': 'UNKNOWN', 'message': 'No data', 'risks': [], 'score': 0}

    if student_data.get('days_inactive', 0) > 14:
        risks.append("No activity in last 14 days")
        risk_score += 30

    if student_data.get('revisions', 0) > 3:
        risks.append("Multiple revisions needed (" + str(student_data['revisions']) + " times)")
        risk_score += 20

    if student_data.get('feedback_delay', 0) > 7:
        risks.append("Slow feedback response (" + str(student_data['feedback_delay']) + " days)")
        risk_score += 20

    if risk_score >= 60:
        return {'level': 'HIGH RISK', 'message': 'Immediate attention needed', 'risks': risks, 'score': risk_score}
    elif risk_score >= 30:
        return {'level': 'MEDIUM RISK', 'message': 'Monitor closely', 'risks': risks, 'score': risk_score}
    else:
        return {'level': 'LOW RISK', 'message': 'On track', 'risks': risks, 'score': risk_score}

def generate_suggestions(results, analysis_type):
    suggestions = []

    if analysis_type in ['idea', 'full']:
        if results.get('idea_quality', {}).get('score', 10) < 7:
            suggestions.append("Improve idea quality by adding more details")
        if results.get('title_quality', {}).get('score', 10) < 7:
            suggestions.append("Make title more descriptive")
        if results.get('domain_match', {}).get('is_match') == False:
            suggestions.append("Add domain-specific keywords to your description")
        if results.get('similarity', {}).get('has_duplicate'):
            suggestions.append("Modify your idea to make it unique")

    if analysis_type in ['document', 'full']:
        if results.get('doc_structure', {}).get('missing'):
            for section in results['doc_structure']['missing'][:2]:
                suggestions.append("Add '" + section + "' section to your document")
        if results.get('content_quality', {}).get('score', 10) < 7:
            suggestions.append("Expand your document with more content")
        if results.get('grammar', {}).get('issue_count', 0) > 0:
            suggestions.append("Fix grammar and spelling issues")

    if len(suggestions) == 0:
        suggestions.append("All checks passed. Project looks good.")

    return suggestions[:5]

def supervisor_decision(idea_score, doc_score, has_issues, is_late=False):
    if is_late:
        return {
            'status': 'LATE SUBMISSION',
            'action': 'Submit with late penalty'
        }

    if idea_score >= 7 and doc_score >= 7 and not has_issues:
        return {
            'status': 'READY FOR REVIEW',
            'action': 'Proceed to approve'
        }
    elif idea_score >= 5 and doc_score >= 5:
        return {
            'status': 'NEEDS IMPROVEMENT',
            'action': 'Fix issues and resubmit'
        }
    else:
        return {
            'status': 'MAJOR REVISION',
            'action': 'Major revision required'
        }

# --- Execution Runners ---

EXISTING_IDEAS = [
    "AI based student performance prediction system",
    "University management portal with chatbot",
    "Automated attendance system using face recognition",
    "SMARTLY DETECT AND PREVENT KIDNEY DISEASE", "CAREER GOALS", "FOOD WHISPER","PERSONALISED RECEPIE APP",
    "AI-based Resume Screening and Ranking System",
    "Fake News Detection using NLP",
    "Sign Language to Text/Speech Translator",
    "Crop Disease Detection using Deep Learning",
    "AI-powered Career Counselling Chatbot",
    "Emotion Detection from Facial Expressions",
    "Blockchain-based Voting System",
    "Supply Chain Management using Blockchain",
    "Smart Attendance System using Facial Recognition",
    "AI-based Traffic Management System"
]

def run_idea_analysis(title, description, domain):
    results = {}
    results['idea_quality'] = check_idea_quality(title, description)
    results['title_quality'] = check_title_quality(title)
    results['similarity'] = check_similarity(title, description, EXISTING_IDEAS)
    results['domain_match'] = check_domain_match(title, description, domain)
    
    idea_avg = (results['idea_quality']['score'] + results['title_quality']['score']) / 2
    results['overall_score'] = round(idea_avg, 1)
    results['suggestions'] = generate_suggestions(results, 'idea')
    return results

def run_document_analysis(document_text):
    results = {}
    results['doc_structure'] = analyze_document_structure(document_text)
    results['content_quality'] = check_content_quality(document_text)
    results['grammar'] = check_grammar(document_text)
    
    doc_avg = results['content_quality']['score']
    results['overall_score'] = round(doc_avg, 1)
    results['suggestions'] = generate_suggestions(results, 'document')
    return results

def run_full_analysis(title, description, domain, document_text, deadline_date=None, student_data=None):
    results = {}
    
    # Idea
    results['idea_quality'] = check_idea_quality(title, description)
    results['title_quality'] = check_title_quality(title)
    results['similarity'] = check_similarity(title, description, EXISTING_IDEAS)
    results['domain_match'] = check_domain_match(title, description, domain)
    
    # Document
    results['doc_structure'] = analyze_document_structure(document_text)
    results['content_quality'] = check_content_quality(document_text)
    results['grammar'] = check_grammar(document_text)
    
    # Additional
    if deadline_date:
        submission_date = datetime.now()
        results['deadline'] = check_deadline(submission_date, deadline_date)
    
    if student_data:
        results['progress'] = predict_progress(student_data)
        
    idea_avg = (results['idea_quality']['score'] + results['title_quality']['score']) / 2
    doc_avg = results['content_quality']['score']
    results['overall_score'] = round((idea_avg + doc_avg) / 2, 1)
    
    has_issues = results['grammar']['issue_count'] > 0
    is_late = results.get('deadline', {}).get('status') == 'LATE'
    
    results['decision'] = supervisor_decision(idea_avg, doc_avg, has_issues, is_late)
    results['suggestions'] = generate_suggestions(results, 'full')
    
    return results

def run_custom_analysis(title, description, domain, document_text, checks):
    results = {}
    
    # Mapping checks to specific functions
    if 'idea_quality' in checks:
        results['idea_quality'] = check_idea_quality(title, description)
    if 'title_quality' in checks:
        results['title_quality'] = check_title_quality(title)
    if 'similarity' in checks:
        results['similarity'] = check_similarity(title, description, EXISTING_IDEAS)
    if 'domain_match' in checks:
        results['domain_match'] = check_domain_match(title, description, domain)
    
    if 'doc_structure' in checks:
        results['doc_structure'] = analyze_document_structure(document_text)
    if 'content_quality' in checks:
        results['content_quality'] = check_content_quality(document_text)
    if 'grammar' in checks:
        results['grammar'] = check_grammar(document_text)
        
    if 'deadline' in checks:
        results['deadline'] = check_deadline(datetime.now(), datetime.now()) # Example
    if 'progress' in checks:
        results['progress'] = predict_progress({'days_inactive': 5, 'revisions': 1, 'feedback_delay': 2})
        
    return results
