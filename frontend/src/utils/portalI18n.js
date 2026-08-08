/**
 * Candidate portal i18n — lightweight locale strings (no react-i18next dependency).
 */
export const PORTAL_LOCALES = [
  { code: 'en', label: 'English' },
  { code: 'es', label: 'Español' },
  { code: 'fr', label: 'Français' },
  { code: 'de', label: 'Deutsch' },
  { code: 'hi', label: 'हिन्दी' }
];

const STRINGS = {
  en: {
    portalTitle: 'Candidate Portal',
    loginTitle: 'Check your application status',
    emailLabel: 'Email address',
    orgSlugLabel: 'Company (optional)',
    sendLink: 'Send magic link',
    loginSuccess: 'If an application exists for this email, a login link has been sent.',
    myApplications: 'My applications',
    stage: 'Stage',
    appliedOn: 'Applied',
    noApplications: 'No applications found.',
    privacyTitle: 'Your data & privacy',
    privacyBody: 'You can download everything we hold about you, or permanently erase your personal information.',
    downloadData: 'Download my data',
    eraseData: 'Erase my data',
    eraseConfirmTitle: 'Erase my data?',
    eraseConfirmBody: 'This permanently removes your name, email, phone, resume, and demographics from applications with this company. This cannot be undone.',
    language: 'Language'
  },
  es: {
    portalTitle: 'Portal del candidato',
    loginTitle: 'Consulta el estado de tu solicitud',
    emailLabel: 'Correo electrónico',
    orgSlugLabel: 'Empresa (opcional)',
    sendLink: 'Enviar enlace',
    loginSuccess: 'Si existe una solicitud, se ha enviado un enlace.',
    myApplications: 'Mis solicitudes',
    stage: 'Etapa',
    appliedOn: 'Solicitado',
    noApplications: 'No se encontraron solicitudes.',
    privacyTitle: 'Tus datos y privacidad',
    privacyBody: 'Puedes descargar todo lo que tenemos sobre ti o borrar permanentemente tu información personal.',
    downloadData: 'Descargar mis datos',
    eraseData: 'Borrar mis datos',
    eraseConfirmTitle: '¿Borrar mis datos?',
    eraseConfirmBody: 'Esto elimina permanentemente tu nombre, correo, teléfono y currículum. No se puede deshacer.',
    language: 'Idioma'
  },
  fr: {
    portalTitle: 'Portail candidat',
    loginTitle: 'Consultez le statut de votre candidature',
    emailLabel: 'Adresse e-mail',
    orgSlugLabel: 'Entreprise (optionnel)',
    sendLink: 'Envoyer le lien',
    loginSuccess: 'Si une candidature existe, un lien a été envoyé.',
    myApplications: 'Mes candidatures',
    stage: 'Étape',
    appliedOn: 'Postulé',
    noApplications: 'Aucune candidature trouvée.',
    privacyTitle: 'Vos données et confidentialité',
    privacyBody: 'Vous pouvez télécharger vos données ou effacer définitivement vos informations personnelles.',
    downloadData: 'Télécharger mes données',
    eraseData: 'Effacer mes données',
    eraseConfirmTitle: 'Effacer mes données ?',
    eraseConfirmBody: 'Cela supprime définitivement votre nom, e-mail, téléphone et CV. Irréversible.',
    language: 'Langue'
  },
  de: {
    portalTitle: 'Bewerberportal',
    loginTitle: 'Bewerbungsstatus prüfen',
    emailLabel: 'E-Mail-Adresse',
    orgSlugLabel: 'Unternehmen (optional)',
    sendLink: 'Link senden',
    loginSuccess: 'Falls eine Bewerbung existiert, wurde ein Link gesendet.',
    myApplications: 'Meine Bewerbungen',
    stage: 'Phase',
    appliedOn: 'Beworben',
    noApplications: 'Keine Bewerbungen gefunden.',
    privacyTitle: 'Ihre Daten & Datenschutz',
    privacyBody: 'Sie können Ihre Daten herunterladen oder Ihre personenbezogenen Daten dauerhaft löschen.',
    downloadData: 'Meine Daten herunterladen',
    eraseData: 'Meine Daten löschen',
    eraseConfirmTitle: 'Meine Daten löschen?',
    eraseConfirmBody: 'Name, E-Mail, Telefon und Lebenslauf werden dauerhaft entfernt. Dies kann nicht rückgängig gemacht werden.',
    language: 'Sprache'
  },
  hi: {
    portalTitle: 'उम्मीदवार पोर्टल',
    loginTitle: 'अपने आवेदन की स्थिति देखें',
    emailLabel: 'ईमेल पता',
    orgSlugLabel: 'कंपनी (वैकल्पिक)',
    sendLink: 'लिंक भेजें',
    loginSuccess: 'यदि आवेदन मौजूद है, तो लिंक भेज दिया गया है।',
    myApplications: 'मेरे आवेदन',
    stage: 'चरण',
    appliedOn: 'आवेदन',
    noApplications: 'कोई आवेदन नहीं मिला।',
    privacyTitle: 'आपका डेटा और गोपनीयता',
    privacyBody: 'आप अपना डेटा डाउनलोड कर सकते हैं या व्यक्तिगत जानकारी स्थायी रूप से मिटा सकते हैं।',
    downloadData: 'मेरा डेटा डाउनलोड करें',
    eraseData: 'मेरा डेटा मिटाएं',
    eraseConfirmTitle: 'मेरा डेटा मिटाएं?',
    eraseConfirmBody: 'नाम, ईमेल, फ़ोन और रिज़्यूमे स्थायी रूप से हट जाएंगे। इसे वापस नहीं किया जा सकता।',
    language: 'भाषा'
  }
};

const LOCALE_COOKIE = 'skillnix_portal_locale';

export const getPortalLocale = (searchParams) => {
  const fromQuery = searchParams?.get('locale');
  if (fromQuery && STRINGS[fromQuery]) return fromQuery;
  const match = document.cookie.match(new RegExp(`(?:^|; )${LOCALE_COOKIE}=([^;]*)`));
  if (match && STRINGS[decodeURIComponent(match[1])]) return decodeURIComponent(match[1]);
  return 'en';
};

export const setPortalLocale = (locale) => {
  document.cookie = `${LOCALE_COOKIE}=${encodeURIComponent(locale)};path=/;max-age=31536000`;
};

export const t = (locale, key) => STRINGS[locale]?.[key] || STRINGS.en[key] || key;

export default STRINGS;
