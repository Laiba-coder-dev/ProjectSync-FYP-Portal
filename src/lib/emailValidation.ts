/**
 * Email Validation and Role Assignment Utilities
 * 
 * This module enforces strict email-based authentication rules:
 * - Only @uskt.edu.pk domain allowed
 * - Automatic role assignment based on email pattern
 * - Server-side validation (client-side is supplementary)
 */

import { UserRole } from '@/types';

// Allowed email domain
const ALLOWED_DOMAIN = '@uskt.edu.pk';

// Email pattern regexes
const STUDENT_PATTERN = /^[0-9]+.*@uskt\.edu\.pk$/i;
const TEACHER_PATTERN = /^[A-Za-z].*@uskt\.edu\.pk$/i;
const DOMAIN_PATTERN = /@uskt\.edu\.pk$/i;

/**
 * Validates if email ends with the allowed domain
 * @param email - Email address to validate
 * @returns true if email ends with @uskt.edu.pk
 */
export function isValidDomain(email: string): boolean {
    if (!email || typeof email !== 'string') {
        return false;
    }

    const normalizedEmail = email.trim().toLowerCase();
    return DOMAIN_PATTERN.test(normalizedEmail);
}

/**
 * Extracts the local-part from an email address
 * @param email - Full email address
 * @returns The local-part before @
 */
function getLocalPart(email: string): string {
    const parts = email.split('@');
    return parts[0] || '';
}

/**
 * Determines user role based on email pattern
 * 
 * Rules:
 * - Student: local-part starts with digit(s)
 * - Supervisor (Teacher/Staff): local-part starts with letter(s)
 * 
 * @param email - Email address to analyze
 * @returns 'student' | 'supervisor' | null
 */
export function getEmailRole(email: string): 'student' | 'supervisor' | null {
    if (!email || typeof email !== 'string') {
        return null;
    }

    const normalizedEmail = email.trim().toLowerCase();

    // Check if it matches student pattern (starts with digits)
    if (STUDENT_PATTERN.test(normalizedEmail)) {
        return 'student';
    }

    // Check if it matches teacher pattern (starts with letters)
    if (TEACHER_PATTERN.test(normalizedEmail)) {
        return 'supervisor';
    }

    // Doesn't match any valid pattern
    return null;
}

/**
 * Comprehensive email validation with role determination
 * 
 * This is the primary validation function used during authentication.
 * 
 * @param email - Email address to validate
 * @returns Validation result with role and error message
 */
export function validateEmailAndGetRole(email: string): {
    isValid: boolean;
    role: 'student' | 'supervisor' | null;
    error?: string;
} {
    // Check if email is provided
    if (!email || typeof email !== 'string' || email.trim() === '') {
        return {
            isValid: false,
            role: null,
            error: 'Email address is required',
        };
    }

    const normalizedEmail = email.trim();

    // Validate domain
    if (!isValidDomain(normalizedEmail)) {
        return {
            isValid: false,
            role: null,
            error: 'Only @uskt.edu.pk email addresses are allowed',
        };
    }

    // Determine role from email pattern
    const role = getEmailRole(normalizedEmail);

    if (!role) {
        return {
            isValid: false,
            role: null,
            error: 'Invalid email format. Email must start with letters (for staff) or numbers (for students)',
        };
    }

    // All validations passed
    return {
        isValid: true,
        role,
    };
}

/**
 * Client-side helper to get role display name
 * @param email - Email address
 * @returns User-friendly role name or null
 */
export function getRoleDisplayName(email: string): string | null {
    const role = getEmailRole(email);

    if (!role) return null;

    return role === 'student' ? 'Student' : 'Teacher/Staff';
}

/**
 * Validates email format for display purposes (non-blocking)
 * Returns user-friendly messages for UI feedback
 */
export function getEmailValidationMessage(email: string): {
    type: 'success' | 'error' | 'warning' | null;
    message: string | null;
    role: string | null;
} {
    if (!email || email.trim() === '') {
        return { type: null, message: null, role: null };
    }

    const validation = validateEmailAndGetRole(email);

    if (!validation.isValid) {
        return {
            type: 'error',
            message: validation.error || 'Invalid email',
            role: null,
        };
    }

    return {
        type: 'success',
        message: `Valid ${validation.role === 'student' ? 'student' : 'teacher/staff'} email`,
        role: validation.role === 'student' ? 'Student' : 'Teacher/Staff',
    };
}
