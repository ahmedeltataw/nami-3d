'use client';

import { useState, type ChangeEvent, type JSX } from 'react';
import { useTranslations } from 'next-intl';
import {
  ApplicationSchema,
  validateCvFile,
  type ApplicationInput,
  type FormAdapter,
  submitApplication,
  useFormMachine,
} from '@/forms';
import styles from './CareersForm.module.css';

export interface CareersRoleOption {
  id: string;
  title: string;
}

export interface CareersFormProps {
  roles: CareersRoleOption[];
  hrEmail?: string | null;
  acceptedFormats: string[];
  adapter?: FormAdapter<ApplicationInput>;
}

const INITIAL_VALUES: ApplicationInput = {
  name: '',
  email: '',
  phone: '',
  role: '',
  message: '',
  cv: {
    name: '',
    size: 0,
    type: '',
  },
};

export function CareersForm({
  roles,
  hrEmail,
  acceptedFormats,
  adapter,
}: CareersFormProps): JSX.Element {
  const t = useTranslations('Forms');
  const tCareers = useTranslations('Careers');
  const [fileError, setFileError] = useState<string | null>(null);

  const defaultRole = roles.length > 0 ? roles[0].title : t('generalApplication');

  const {
    values,
    errors,
    status,
    statusMessage,
    isSubmitting,
    setFieldValue,
    handleSubmit,
    retry,
  } = useFormMachine<ApplicationInput>({
    initialValues: {
      ...INITIAL_VALUES,
      role: defaultRole,
    },
    schema: ApplicationSchema,
    storageKey: 'nami.form.application',
    submitFn: async data => {
      if (adapter) {
        return adapter(data);
      }
      return submitApplication(data);
    },
  });

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) {
      setFieldValue('cv', { name: '', size: 0, type: '' });
      setFileError(null);
      return;
    }

    const validation = validateCvFile({
      name: file.name,
      size: file.size,
      type: file.type,
    });

    if (!validation.valid) {
      setFileError(validation.error || t('cvInvalidType'));
      e.target.value = '';
      setFieldValue('cv', { name: '', size: 0, type: '' });
      return;
    }

    setFileError(null);
    setFieldValue('cv', {
      name: file.name,
      size: file.size,
      type: file.type || 'application/octet-stream',
    });
  };

  const hrMail = hrEmail || 'hr@nami-tec.com';
  const roleName = values.role || defaultRole;

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <h2 className={styles.title}>{tCareers('formHeading')}</h2>
        <p className={styles.subtitle}>{tCareers('formSubtitle')}</p>
      </header>

      <form onSubmit={handleSubmit} noValidate className={styles.form}>
        {/* Name Field */}
        <div className={styles.field}>
          <label htmlFor="careers-name" className={styles.label}>
            <span>{t('nameLabel')} *</span>
          </label>
          <input
            id="careers-name"
            name="name"
            type="text"
            required
            autoComplete="name"
            placeholder={t('namePlaceholder')}
            className={styles.input}
            value={values.name}
            onChange={e => setFieldValue('name', e.target.value)}
            aria-required="true"
            aria-invalid={Boolean(errors.name)}
            aria-describedby={errors.name ? 'careers-name-error' : undefined}
          />
          {errors.name && (
            <span id="careers-name-error" className={styles.errorText} role="alert">
              {errors.name}
            </span>
          )}
        </div>

        {/* Email Field */}
        <div className={styles.field}>
          <label htmlFor="careers-email" className={styles.label}>
            <span>{t('emailLabel')} *</span>
          </label>
          <input
            id="careers-email"
            name="email"
            type="email"
            required
            autoComplete="email"
            placeholder={t('emailPlaceholder')}
            className={styles.input}
            value={values.email}
            onChange={e => setFieldValue('email', e.target.value)}
            aria-required="true"
            aria-invalid={Boolean(errors.email)}
            aria-describedby={errors.email ? 'careers-email-error' : undefined}
          />
          {errors.email && (
            <span id="careers-email-error" className={styles.errorText} role="alert">
              {errors.email}
            </span>
          )}
        </div>

        {/* Phone Field */}
        <div className={styles.field}>
          <label htmlFor="careers-phone" className={styles.label}>
            <span>{t('phoneLabel')} *</span>
          </label>
          <input
            id="careers-phone"
            name="phone"
            type="tel"
            required
            autoComplete="tel"
            placeholder={t('phonePlaceholder')}
            className={styles.input}
            value={values.phone}
            onChange={e => setFieldValue('phone', e.target.value)}
            aria-required="true"
            aria-invalid={Boolean(errors.phone)}
            aria-describedby={errors.phone ? 'careers-phone-error' : undefined}
          />
          {errors.phone && (
            <span id="careers-phone-error" className={styles.errorText} role="alert">
              {errors.phone}
            </span>
          )}
        </div>

        {/* Role Field */}
        <div className={styles.field}>
          <label htmlFor="careers-role" className={styles.label}>
            <span>{t('roleLabel')} *</span>
          </label>
          <select
            id="careers-role"
            name="role"
            required
            className={styles.select}
            value={values.role || defaultRole}
            onChange={e => setFieldValue('role', e.target.value)}
            aria-required="true"
            aria-invalid={Boolean(errors.role)}
            aria-describedby={errors.role ? 'careers-role-error' : undefined}
          >
            {roles.map(r => (
              <option key={r.id} value={r.title}>
                {r.title}
              </option>
            ))}
            <option value={t('generalApplication')}>{t('generalApplication')}</option>
          </select>
          {errors.role && (
            <span id="careers-role-error" className={styles.errorText} role="alert">
              {errors.role}
            </span>
          )}
        </div>

        {/* Message / Cover Note */}
        <div className={styles.field}>
          <label htmlFor="careers-message" className={styles.label}>
            <span>{t('applicationMessageLabel')} *</span>
          </label>
          <textarea
            id="careers-message"
            name="message"
            required
            rows={4}
            placeholder={t('applicationMessagePlaceholder')}
            className={styles.textarea}
            value={values.message}
            onChange={e => setFieldValue('message', e.target.value)}
            aria-required="true"
            aria-invalid={Boolean(errors.message)}
            aria-describedby={errors.message ? 'careers-message-error' : undefined}
          />
          {errors.message && (
            <span id="careers-message-error" className={styles.errorText} role="alert">
              {errors.message}
            </span>
          )}
        </div>

        {/* CV File Input */}
        <div className={styles.field}>
          <label htmlFor="careers-cv" className={styles.label}>
            <span>{t('cvLabel')} *</span>
          </label>
          <div className={styles.fileInputWrapper}>
            <input
              id="careers-cv"
              name="cv"
              type="file"
              accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
              onChange={handleFileChange}
              className={styles.fileInput}
              aria-required="true"
              aria-invalid={Boolean(fileError || errors.cv)}
              aria-describedby={
                fileError || errors.cv ? 'careers-cv-error' : 'careers-cv-help'
              }
            />
            <p id="careers-cv-help" className={styles.fileHelper}>
              {acceptedFormats.length > 0
                ? `${tCareers('acceptedFormats')}: ${acceptedFormats.join(', ')}`
                : t('cvHelp')}
            </p>
            {values.cv?.name && (
              <div className={styles.selectedFileInfo} data-testid="selected-file-info">
                <span>📎 {values.cv.name}</span>
                <span>({(values.cv.size / 1024).toFixed(1)} KB)</span>
              </div>
            )}
          </div>
          {(fileError || errors.cv) && (
            <span id="careers-cv-error" className={styles.errorText} role="alert">
              {fileError || errors.cv || t('cvRequired')}
            </span>
          )}
        </div>

        {/* Submit Button */}
        <button
          type="submit"
          disabled={isSubmitting}
          className={styles.submitButton}
        >
          {isSubmitting ? t('submitting') : t('submitApplication')}
        </button>
      </form>

      {/* Accessible status region with aria-live */}
      <div
        aria-live="polite"
        role="region"
        aria-label="Application Submission Status"
        className={styles.statusRegion}
      >
        {status === 'success' && (
          <div className={`${styles.statusBanner} ${styles.statusSuccess}`}>
            <h3 className={styles.statusTitle}>{t('successTitle')}</h3>
            <p className={styles.statusMessage}>{statusMessage || t('successMessage')}</p>
          </div>
        )}

        {status === 'unavailable' && (
          <div className={`${styles.statusBanner} ${styles.statusUnavailable}`} data-testid="careers-status-unavailable">
            <h3 className={styles.statusTitle}>{t('unavailableTitle')}</h3>
            <p className={styles.statusMessage}>{t('unavailableCareersMessage')}</p>

            <div className={styles.directHrSection}>
              <a
                href={`mailto:${hrMail}?subject=${encodeURIComponent(
                  `Application for ${roleName}`
                )}`}
                className={styles.directHrLink}
              >
                ✉️ {t('sendHrEmail')}: {hrMail}
              </a>
            </div>

            <button
              type="button"
              onClick={retry}
              className={styles.retryButton}
            >
              {t('retry')}
            </button>
          </div>
        )}

        {status === 'error' && (
          <div className={`${styles.statusBanner} ${styles.statusError}`} data-testid="careers-status-error">
            <h3 className={styles.statusTitle}>{t('errorTitle')}</h3>
            <p className={styles.statusMessage}>{statusMessage || t('errorMessage')}</p>
            <button
              type="button"
              onClick={retry}
              className={styles.retryButton}
            >
              {t('retry')}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
