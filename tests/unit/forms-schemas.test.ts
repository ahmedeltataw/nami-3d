import { describe, expect, it } from 'vitest';
import {
  ApplicationSchema,
  CvFileMetadataSchema,
  LeadSchema,
  validateCvFile,
} from '../../src/forms/schemas';

describe('LeadSchema', () => {
  it('accepts valid input with all fields present', () => {
    const valid = {
      name: 'Ahmed Ali',
      email: 'ahmed@example.com',
      phone: '+966500000000',
      projectType: 'web' as const,
      message: 'I would like to develop a 3D website.',
    };
    const result = LeadSchema.safeParse(valid);
    expect(result.success).toBe(true);
  });

  it('accepts valid input when phone is empty or omitted', () => {
    const withoutPhone = {
      name: 'Sarah Smith',
      email: 'sarah@example.com',
      phone: '',
      projectType: 'mobile' as const,
      message: 'Mobile app consultation inquiry.',
    };
    expect(LeadSchema.safeParse(withoutPhone).success).toBe(true);

    const omittedPhone = {
      name: 'Sarah Smith',
      email: 'sarah@example.com',
      projectType: 'marketing' as const,
      message: 'Marketing inquiry.',
    };
    expect(LeadSchema.safeParse(omittedPhone).success).toBe(true);
  });

  it('rejects invalid email', () => {
    const invalid = {
      name: 'John Doe',
      email: 'not-an-email',
      projectType: 'other' as const,
      message: 'Hello',
    };
    const result = LeadSchema.safeParse(invalid);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some(i => i.path.includes('email'))).toBe(true);
    }
  });

  it('rejects empty name or empty message', () => {
    const emptyName = {
      name: '   ',
      email: 'test@example.com',
      projectType: 'web' as const,
      message: 'Valid message',
    };
    expect(LeadSchema.safeParse(emptyName).success).toBe(false);

    const emptyMsg = {
      name: 'Valid Name',
      email: 'test@example.com',
      projectType: 'web' as const,
      message: '   ',
    };
    expect(LeadSchema.safeParse(emptyMsg).success).toBe(false);
  });

  it('rejects invalid project type', () => {
    const invalid = {
      name: 'Valid Name',
      email: 'test@example.com',
      projectType: 'unsupported-type',
      message: 'Hello',
    };
    expect(LeadSchema.safeParse(invalid).success).toBe(false);
  });
});

describe('CvFileMetadataSchema and validateCvFile', () => {
  it('accepts valid PDF, DOC, DOCX files under 5MB', () => {
    const validPdf = { name: 'resume.pdf', size: 1024 * 500, type: 'application/pdf' };
    const validDoc = { name: 'cv.doc', size: 1024 * 1024 };
    const validDocx = { name: 'portfolio_cv.DOCX', size: 5 * 1024 * 1024 };

    expect(CvFileMetadataSchema.safeParse(validPdf).success).toBe(true);
    expect(CvFileMetadataSchema.safeParse(validDoc).success).toBe(true);
    expect(CvFileMetadataSchema.safeParse(validDocx).success).toBe(true);
    expect(validateCvFile(validPdf).valid).toBe(true);
  });

  it('rejects files exceeding 5MB', () => {
    const oversize = { name: 'cv.pdf', size: 5 * 1024 * 1024 + 1 };
    const result = CvFileMetadataSchema.safeParse(oversize);
    expect(result.success).toBe(false);
    expect(validateCvFile(oversize).valid).toBe(false);
  });

  it('rejects forbidden file extensions', () => {
    const exe = { name: 'resume.exe', size: 1024 };
    const png = { name: 'cv.png', size: 1024 };
    const zip = { name: 'archive.zip', size: 1024 };

    expect(CvFileMetadataSchema.safeParse(exe).success).toBe(false);
    expect(CvFileMetadataSchema.safeParse(png).success).toBe(false);
    expect(CvFileMetadataSchema.safeParse(zip).success).toBe(false);

    const validation = validateCvFile(png);
    expect(validation.valid).toBe(false);
    expect(validation.error).toBeDefined();
  });

  it('rejects empty or zero-size files', () => {
    const emptyFile = { name: 'cv.pdf', size: 0 };
    expect(CvFileMetadataSchema.safeParse(emptyFile).success).toBe(false);
  });
});

describe('ApplicationSchema', () => {
  it('accepts valid application data with CV metadata', () => {
    const valid = {
      name: 'Fatima Zahra',
      email: 'fatima@example.com',
      phone: '+966512345678',
      role: 'Frontend Engineer',
      message: 'Excited about 3D web experiences.',
      cv: {
        name: 'fatima_cv.pdf',
        size: 1024 * 200,
        type: 'application/pdf',
      },
    };
    expect(ApplicationSchema.safeParse(valid).success).toBe(true);
  });

  it('rejects application missing required fields', () => {
    const missingPhone = {
      name: 'Fatima Zahra',
      email: 'fatima@example.com',
      role: 'Frontend Engineer',
      message: 'Excited',
      cv: { name: 'cv.pdf', size: 1024 },
    };
    expect(ApplicationSchema.safeParse(missingPhone).success).toBe(false);

    const missingRole = {
      name: 'Fatima Zahra',
      email: 'fatima@example.com',
      phone: '+123456789',
      role: '  ',
      message: 'Excited',
      cv: { name: 'cv.pdf', size: 1024 },
    };
    expect(ApplicationSchema.safeParse(missingRole).success).toBe(false);
  });
});
