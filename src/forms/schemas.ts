import { z } from 'zod';

export const PROJECT_TYPES = ['web', 'mobile', 'marketing', 'other'] as const;
export type ProjectType = (typeof PROJECT_TYPES)[number];

export const LeadSchema = z.strictObject({
  name: z.string().trim().min(1, 'Name is required'),
  email: z.string().trim().email('Invalid email address'),
  phone: z.string().trim().optional().or(z.literal('')),
  projectType: z.enum(PROJECT_TYPES),
  message: z.string().trim().min(1, 'Message is required'),
});

export type LeadInput = z.infer<typeof LeadSchema>;

export const CV_MAX_SIZE_BYTES = 5 * 1024 * 1024; // 5MB
export const CV_ALLOWED_EXTENSIONS = ['.pdf', '.doc', '.docx'] as const;

export const CvFileMetadataSchema = z.strictObject({
  name: z
    .string()
    .trim()
    .min(1, 'File name is required')
    .refine(
      name => /\.(pdf|docx?)$/i.test(name),
      'CV must be a PDF or Word document (.pdf, .doc, .docx)'
    ),
  size: z
    .number()
    .positive('File must not be empty')
    .max(CV_MAX_SIZE_BYTES, 'CV file size must not exceed 5MB'),
  type: z.string().optional(),
});

export type CvFileMetadata = z.infer<typeof CvFileMetadataSchema>;

export function validateCvFile(file: { name: string; size: number; type?: string }): {
  valid: boolean;
  error?: string;
} {
  const result = CvFileMetadataSchema.safeParse(file);
  if (!result.success) {
    const firstIssue = result.error.issues[0];
    return { valid: false, error: firstIssue?.message ?? 'Invalid CV file' };
  }
  return { valid: true };
}

export const ApplicationSchema = z.strictObject({
  name: z.string().trim().min(1, 'Name is required'),
  email: z.string().trim().email('Invalid email address'),
  phone: z.string().trim().min(1, 'Phone is required'),
  role: z.string().trim().min(1, 'Role is required'),
  message: z.string().trim().min(1, 'Message is required'),
  cv: CvFileMetadataSchema,
});

export type ApplicationInput = z.infer<typeof ApplicationSchema>;
