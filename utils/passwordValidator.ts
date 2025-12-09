export interface PasswordStrength {
  score: number; // 0-4
  valid: boolean;
  feedback: string[];
}

const PASSWORD_MIN_LENGTH = 8;
const PASSWORD_MAX_LENGTH = 128;

export function validatePasswordStrength(password: string): PasswordStrength {
  const feedback: string[] = [];
  let score = 0;

  // Check length
  if (password.length < PASSWORD_MIN_LENGTH) {
    feedback.push(`Password must be at least ${PASSWORD_MIN_LENGTH} characters long`);
  } else {
    score++;
  }

  if (password.length > PASSWORD_MAX_LENGTH) {
    feedback.push(`Password must not exceed ${PASSWORD_MAX_LENGTH} characters`);
  }

  // Check for uppercase
  if (/[A-Z]/.test(password)) {
    score++;
  } else {
    feedback.push('Password should contain at least one uppercase letter');
  }

  // Check for lowercase
  if (/[a-z]/.test(password)) {
    score++;
  } else {
    feedback.push('Password should contain at least one lowercase letter');
  }

  // Check for numbers
  if (/\d/.test(password)) {
    score++;
  } else {
    feedback.push('Password should contain at least one number');
  }

  // Check for special characters
  if (/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
    score++;
  } else {
    feedback.push('Password should contain at least one special character');
  }

  // Check for common patterns (optional, but recommended)
  const commonPatterns = [
    /^123.*/, // 123...
    /^abc.*/, // abc...
    /^password.*/, // password...
    /^qwerty.*/, // qwerty...
    /(.)\1{2,}/, // repeating characters
  ];

  if (commonPatterns.some((pattern) => pattern.test(password))) {
    feedback.push('Password contains common or repeating patterns');
    score = Math.max(0, score - 1);
  }

  return {
    score: Math.min(4, score),
    valid: score >= 3 && feedback.length === 0,
    feedback,
  };
}

export function isPasswordValid(password: string): boolean {
  return validatePasswordStrength(password).valid;
}
