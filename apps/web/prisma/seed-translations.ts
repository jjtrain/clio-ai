import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("Seeding languages...");

  const languages = [
    { languageCode: "es", languageName: "Spanish", nativeName: "Español", isRTL: false },
    { languageCode: "zh", languageName: "Chinese (Simplified)", nativeName: "中文（简体）", isRTL: false, fontFamily: '"Noto Sans SC", "PingFang SC", sans-serif' },
    { languageCode: "ru", languageName: "Russian", nativeName: "Русский", isRTL: false },
    { languageCode: "ht", languageName: "Haitian Creole", nativeName: "Kreyòl Ayisyen", isRTL: false },
    { languageCode: "ko", languageName: "Korean", nativeName: "한국어", isRTL: false, fontFamily: '"Noto Sans KR", "Malgun Gothic", sans-serif' },
    { languageCode: "ar", languageName: "Arabic", nativeName: "العربية", isRTL: true, fontFamily: '"Noto Sans Arabic", "Tahoma", sans-serif' },
    { languageCode: "pt", languageName: "Portuguese", nativeName: "Português", isRTL: false },
    { languageCode: "fr", languageName: "French", nativeName: "Français", isRTL: false },
    { languageCode: "pl", languageName: "Polish", nativeName: "Polski", isRTL: false },
    { languageCode: "hi", languageName: "Hindi", nativeName: "हिन्दी", isRTL: false, fontFamily: '"Noto Sans Devanagari", sans-serif' },
  ];

  for (const lang of languages) {
    await prisma.languageConfig.upsert({
      where: { languageCode: lang.languageCode },
      create: { ...lang, isActive: true },
      update: { languageName: lang.languageName, nativeName: lang.nativeName },
    });
  }
  console.log(`Seeded ${languages.length} languages.`);

  // Spanish UI translations
  console.log("Seeding Spanish UI translations...");
  const esUI: Record<string, string> = {
    "portal.nav.dashboard": "Panel Principal",
    "portal.nav.timeline": "Mi Línea de Tiempo",
    "portal.nav.messages": "Mensajes",
    "portal.nav.documents": "Documentos",
    "portal.nav.billing": "Facturación",
    "portal.nav.checklist": "Lista de Tareas",
    "portal.nav.events": "Eventos",
    "portal.nav.profile": "Perfil",
    "portal.nav.notifications": "Notificaciones",
    "portal.nav.logout": "Cerrar Sesión",
    "portal.actions.pay_now": "Pagar Ahora",
    "portal.actions.upload": "Subir Documento",
    "portal.actions.send_message": "Enviar Mensaje",
    "portal.actions.view_details": "Ver Detalles",
    "portal.actions.download": "Descargar",
    "portal.actions.sign": "Firmar Documento",
    "portal.actions.submit": "Enviar",
    "portal.actions.cancel": "Cancelar",
    "portal.actions.save": "Guardar",
    "portal.actions.back": "Atrás",
    "portal.actions.next": "Siguiente",
    "portal.actions.close": "Cerrar",
    "portal.timeline.you_are_here": "Usted Está Aquí",
    "portal.timeline.completed": "Completado",
    "portal.timeline.upcoming": "Próximamente",
    "portal.timeline.estimated": "Estimado",
    "portal.timeline.action_needed": "Acción Requerida",
    "portal.messages.new_message": "Nuevo Mensaje",
    "portal.messages.type_message": "Escriba su mensaje...",
    "portal.messages.translated_from": "Traducido del inglés",
    "portal.messages.show_original": "Mostrar Original",
    "portal.messages.no_messages": "Aún no hay mensajes. Envíe un mensaje a su abogado en cualquier momento.",
    "portal.documents.upload_prompt": "Arrastre archivos aquí o haga clic para subir",
    "portal.documents.categories.medical": "Registros Médicos",
    "portal.documents.categories.accident": "Documentos del Accidente",
    "portal.documents.categories.insurance": "Seguro",
    "portal.documents.categories.court": "Documentos del Tribunal",
    "portal.documents.categories.financial": "Documentos Financieros",
    "portal.billing.outstanding": "Saldo Pendiente",
    "portal.billing.payment_plan": "Plan de Pago",
    "portal.billing.next_payment": "Próximo Pago",
    "portal.billing.receipt": "Recibo",
    "portal.billing.auto_pay_on": "Pago automático ACTIVADO",
    "portal.billing.contingency_note": "Su caso se maneja sobre una base de honorarios de contingencia — no hay honorarios a menos que obtengamos una compensación para usted.",
    "portal.survey.how_rate": "¿Cómo calificaría su experiencia?",
    "portal.survey.very_satisfied": "Muy Satisfecho",
    "portal.survey.satisfied": "Satisfecho",
    "portal.survey.neutral": "Neutral",
    "portal.survey.dissatisfied": "Insatisfecho",
    "portal.survey.very_dissatisfied": "Muy Insatisfecho",
    "portal.survey.thank_you": "¡Gracias por sus comentarios!",
    "portal.login.title": "Portal del Cliente",
    "portal.login.send_link": "Enviar Enlace de Acceso",
    "portal.login.check_email": "Revise su correo electrónico — le hemos enviado un enlace seguro de acceso.",
    "portal.welcome.pi": "Hola {{firstName}}, aquí están las últimas noticias sobre su caso.",
    "portal.welcome.family": "Hola {{firstName}}, estamos aquí para apoyarle durante este proceso.",
    "portal.welcome.immigration": "Hola {{firstName}}, aquí tiene una actualización sobre su caso de inmigración.",
    "portal.phases.pi.discovery": "Intercambio de Información",
    "portal.phases.pi.filed": "Demanda Presentada",
    "portal.phases.pi.negotiations": "Negociaciones",
    "portal.phases.pi.resolution": "Resolución",
  };

  for (const [key, text] of Object.entries(esUI)) {
    await prisma.uITranslation.upsert({
      where: { translationKey_languageCode: { translationKey: key, languageCode: "es" } },
      create: { translationKey: key, languageCode: "es", translatedText: text },
      update: { translatedText: text },
    });
  }
  console.log(`Seeded ${Object.keys(esUI).length} Spanish UI translations.`);

  // Spanish Legal Glossary
  console.log("Seeding Spanish glossary...");
  const esGlossary = [
    { englishTerm: "attorney", translatedTerm: "abogado/abogada", category: "legal" },
    { englishTerm: "lawsuit", translatedTerm: "demanda", category: "legal" },
    { englishTerm: "court", translatedTerm: "tribunal", category: "legal" },
    { englishTerm: "judge", translatedTerm: "juez/jueza", category: "legal" },
    { englishTerm: "plaintiff", translatedTerm: "demandante", category: "legal" },
    { englishTerm: "defendant", translatedTerm: "demandado/demandada", category: "legal" },
    { englishTerm: "settlement", translatedTerm: "acuerdo", category: "legal" },
    { englishTerm: "trial", translatedTerm: "juicio", category: "legal" },
    { englishTerm: "hearing", translatedTerm: "audiencia", category: "legal" },
    { englishTerm: "statute of limitations", translatedTerm: "prescripción", category: "legal" },
    { englishTerm: "discovery", translatedTerm: "descubrimiento de pruebas", category: "practice_area", practiceArea: "personal_injury" },
    { englishTerm: "deposition", translatedTerm: "declaración jurada / deposición", category: "practice_area", practiceArea: "personal_injury" },
    { englishTerm: "demand letter", translatedTerm: "carta de demanda", category: "practice_area", practiceArea: "personal_injury" },
    { englishTerm: "petition", translatedTerm: "petición", category: "practice_area", practiceArea: "immigration" },
    { englishTerm: "adjustment of status", translatedTerm: "ajuste de estatus", category: "practice_area", practiceArea: "immigration" },
    { englishTerm: "asylum", translatedTerm: "asilo", category: "practice_area", practiceArea: "immigration" },
    { englishTerm: "work permit", translatedTerm: "permiso de trabajo", category: "practice_area", practiceArea: "immigration" },
    { englishTerm: "divorce", translatedTerm: "divorcio", category: "practice_area", practiceArea: "family_law" },
    { englishTerm: "custody", translatedTerm: "custodia", category: "practice_area", practiceArea: "family_law" },
    { englishTerm: "child support", translatedTerm: "manutención de menores", category: "practice_area", practiceArea: "family_law" },
    { englishTerm: "alimony", translatedTerm: "pensión alimenticia", category: "practice_area", practiceArea: "family_law" },
    { englishTerm: "mediation", translatedTerm: "mediación", category: "practice_area", practiceArea: "family_law" },
  ];

  for (const term of esGlossary) {
    await prisma.translationGlossary.upsert({
      where: { languageCode_englishTerm_practiceArea: { languageCode: "es", englishTerm: term.englishTerm, practiceArea: term.practiceArea || "" } },
      create: { languageCode: "es", ...term, practiceArea: term.practiceArea || null },
      update: { translatedTerm: term.translatedTerm },
    });
  }
  console.log(`Seeded ${esGlossary.length} Spanish glossary terms.`);

  // Do Not Translate terms
  const dntTerms = [
    { englishTerm: "USCIS", category: "immigration" },
    { englishTerm: "I-485", category: "immigration" },
    { englishTerm: "I-130", category: "immigration" },
    { englishTerm: "I-765", category: "immigration" },
    { englishTerm: "CPLR", category: "legal" },
  ];

  for (const term of dntTerms) {
    for (const lang of ["es", "zh", "ru", "ht"]) {
      await prisma.translationGlossary.upsert({
        where: { languageCode_englishTerm_practiceArea: { languageCode: lang, englishTerm: term.englishTerm, practiceArea: "" } },
        create: { languageCode: lang, englishTerm: term.englishTerm, translatedTerm: term.englishTerm, category: term.category, doNotTranslate: true },
        update: {},
      });
    }
  }
  console.log("Seeded do-not-translate terms.");

  console.log("Translation seed complete!");
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
