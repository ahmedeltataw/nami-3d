'use client';

import { useEffect, type JSX } from 'react';
import { useTranslations } from 'next-intl';
import {
  LeadSchema,
  PROJECT_TYPES,
  type FormAdapter,
  type LeadInput,
  type ProjectType,
  submitLead,
  useFormMachine,
} from '@/forms';
import styles from './ContactForm.module.css';

export interface DirectContactProps {
  phones: string[];
  email?: string | null;
  whatsapp?: string | null;
}

export interface ContactFormProps {
  directContact: DirectContactProps;
  adapter?: FormAdapter<LeadInput>;
}

const INITIAL_VALUES: LeadInput = {
  name: '',
  email: '',
  phone: '',
  projectType: 'web',
  message: '',
};

export function ContactForm({ directContact, adapter }: ContactFormProps): JSX.Element {
  const t = useTranslations('Forms');

  const {
    values,
    errors,
    status,
    statusMessage,
    isSubmitting,
    setFieldValue,
    handleSubmit,
    retry,
  } = useFormMachine<LeadInput>({
    initialValues: INITIAL_VALUES,
    schema: LeadSchema,
    storageKey: 'nami.form.lead',
    submitFn: async data => {
      if (adapter) {
        return adapter(data);
      }
      return submitLead(data);
    },
  });

  // Preselect project type from URL param, sessionStorage, or DOM attribute (#s07)
  useEffect(() => {
    if (typeof window === 'undefined') return;

    // 1. Query parameter
    const params = new URLSearchParams(window.location.search);
    const paramType = params.get('type') || params.get('projectType');
    if (paramType && (PROJECT_TYPES as readonly string[]).includes(paramType)) {
      setFieldValue('projectType', paramType as ProjectType);
      return;
    }

    // 2. sessionStorage key 'nami.projectType'
    try {
      const storedType = window.sessionStorage.getItem('nami.projectType');
      if (storedType && (PROJECT_TYPES as readonly string[]).includes(storedType)) {
        setFieldValue('projectType', storedType as ProjectType);
        return;
      }
    } catch {
      // ignore
    }

    // 3. Attribute data-project-type on #s07
    const s07 = document.getElementById('s07');
    const s07Type = s07?.getAttribute('data-project-type');
    if (s07Type && (PROJECT_TYPES as readonly string[]).includes(s07Type)) {
      setFieldValue('projectType', s07Type as ProjectType);
    }
  }, [setFieldValue]);

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <h2 className={styles.title}>{t('submitLead')}</h2>
        <p className={styles.subtitle}>{t('messagePlaceholder')}</p>
      </header>

      <form onSubmit={handleSubmit} noValidate className={styles.form}>
        {/* Name Field */}
        <div className={styles.field}>
          <label htmlFor="lead-name" className={styles.label}>
            <span>{t('nameLabel')} *</span>
          </label>
          <input
            id="lead-name"
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
            aria-describedby={errors.name ? 'lead-name-error' : undefined}
          />
          {errors.name && (
            <span id="lead-name-error" className={styles.errorText} role="alert">
              {errors.name}
            </span>
          )}
        </div>

        {/* Email Field */}
        <div className={styles.field}>
          <label htmlFor="lead-email" className={styles.label}>
            <span>{t('emailLabel')} *</span>
          </label>
          <input
            id="lead-email"
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
            aria-describedby={errors.email ? 'lead-email-error' : undefined}
          />
          {errors.email && (
            <span id="lead-email-error" className={styles.errorText} role="alert">
              {errors.email}
            </span>
          )}
        </div>

        {/* Phone Field (Optional) */}
        <div className={styles.field}>
          <label htmlFor="lead-phone" className={styles.label}>
            <span>{t('phoneLabel')}</span>
            <span className={styles.optionalTag}>{t('phoneOptional')}</span>
          </label>
          <input
            id="lead-phone"
            name="phone"
            type="tel"
            autoComplete="tel"
            placeholder={t('phonePlaceholder')}
            className={styles.input}
            value={values.phone ?? ''}
            onChange={e => setFieldValue('phone', e.target.value)}
            aria-invalid={Boolean(errors.phone)}
            aria-describedby={errors.phone ? 'lead-phone-error' : undefined}
          />
          {errors.phone && (
            <span id="lead-phone-error" className={styles.errorText} role="alert">
              {errors.phone}
            </span>
          )}
        </div>

        {/* Project Type */}
        <div className={styles.field}>
          <label htmlFor="lead-project-type" className={styles.label}>
            <span>{t('projectTypeLabel')} *</span>
          </label>
          <select
            id="lead-project-type"
            name="projectType"
            required
            className={styles.select}
            value={values.projectType}
            onChange={e => setFieldValue('projectType', e.target.value as ProjectType)}
            aria-required="true"
            aria-invalid={Boolean(errors.projectType)}
            aria-describedby={errors.projectType ? 'lead-project-type-error' : undefined}
          >
            <option value="web">{t('typeWeb')}</option>
            <option value="mobile">{t('typeMobile')}</option>
            <option value="marketing">{t('typeMarketing')}</option>
            <option value="other">{t('typeOther')}</option>
          </select>
          {errors.projectType && (
            <span id="lead-project-type-error" className={styles.errorText} role="alert">
              {errors.projectType}
            </span>
          )}
        </div>

        {/* Message */}
        <div className={styles.field}>
          <label htmlFor="lead-message" className={styles.label}>
            <span>{t('messageLabel')} *</span>
          </label>
          <textarea
            id="lead-message"
            name="message"
            required
            rows={4}
            placeholder={t('messagePlaceholder')}
            className={styles.textarea}
            value={values.message}
            onChange={e => setFieldValue('message', e.target.value)}
            aria-required="true"
            aria-invalid={Boolean(errors.message)}
            aria-describedby={errors.message ? 'lead-message-error' : undefined}
          />
          {errors.message && (
            <span id="lead-message-error" className={styles.errorText} role="alert">
              {errors.message}
            </span>
          )}
        </div>

        {/* Submit Button */}
        <button
          type="submit"
          disabled={isSubmitting}
          className={styles.submitButton}
        >
          {isSubmitting ? t('submitting') : t('submitLead')}
        </button>
      </form>

      {/* Accessible status region with aria-live */}
      <div
        aria-live="polite"
        role="region"
        aria-label="Form Submission Status"
        className={styles.statusRegion}
      >
        {status === 'success' && (
          <div className={`${styles.statusBanner} ${styles.statusSuccess}`}>
            <h3 className={styles.statusTitle}>{t('successTitle')}</h3>
            <p className={styles.statusMessage}>{statusMessage || t('successMessage')}</p>
          </div>
        )}

        {status === 'unavailable' && (
          <div className={`${styles.statusBanner} ${styles.statusUnavailable}`} data-testid="status-unavailable">
            <h3 className={styles.statusTitle}>{t('unavailableTitle')}</h3>
            <p className={styles.statusMessage}>{t('unavailableLeadMessage')}</p>

            {/* Direct contact options from real company data */}
            <div className={styles.directLinksSection}>
              <h4 className={styles.directLinksHeading}>{t('directContactHeading')}</h4>
              <ul className={styles.directLinksList}>
                {directContact.email && (
                  <li>
                    <a
                      href={`mailto:${directContact.email}`}
                      className={styles.directLink}
                    >
                      ✉️ {directContact.email}
                    </a>
                  </li>
                )}
                {directContact.phones.map(phone => (
                  <li key={phone}>
                    <a href={`tel:${phone}`} className={styles.directLink} dir="ltr">
                      📞 {phone}
                    </a>
                  </li>
                ))}
                {directContact.whatsapp && (
                  <li>
                    <a
                      href={directContact.whatsapp}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={styles.directLink}
                    >
                      💬 {t('chatWhatsApp')}
                    </a>
                  </li>
                )}
              </ul>
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
          <div className={`${styles.statusBanner} ${styles.statusError}`} data-testid="status-error">
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
