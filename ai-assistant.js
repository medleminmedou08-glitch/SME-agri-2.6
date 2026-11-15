(function() {
  const onReady = (fn) => document.readyState === 'loading' ? document.addEventListener('DOMContentLoaded', fn, { once: true }) : fn();
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const lsGet = (k, d) => { try { const v = localStorage.getItem(k); return v == null ? d : v; } catch (e) { return d; } };
  const lsSet = (k, v) => { try { localStorage.setItem(k, v); } catch (e) {} };

  const STATE_KEY = 'farm_manager_v1';
  const HIST_KEY = 'sme_ai_history';
  const MODEL = 'gemini-2.5-flash';

  /* ---------------- قراءة بيانات المزرعة من التطبيق ---------------- */
  const readState = () => { try { return JSON.parse(lsGet(STATE_KEY, '{}')) || {}; } catch (e) { return {}; } };
  const readWeather = () => { try { const w = JSON.parse(lsGet(STATE_KEY + '_w', 'null')); return w && w.W ? w : null; } catch (e) { return null; } };
  const sum = (a, f) => (a || []).reduce((x, y) => x + (+f(y) || 0), 0);
  const fmt = (n) => Number(n || 0).toLocaleString('en-US', { maximumFractionDigits: 2 });
  const monthKey = () => new Date().toISOString().slice(0, 7);

  const farmFacts = () => {
    const S = readState(), cur = S.cur || 'MRU', unit = S.areaUnit || 'هكتار';
    const fields = S.fields || [], tx = S.tx || [], items = S.items || [], debts = S.debts || [], workers = S.workers || [];
    const mk = monthKey();
    const mt = tx.filter(t => String(t.date || '').startsWith(mk));
    const inc = sum(mt.filter(t => t.type === 'income'), t => t.amount);
    const exp = sum(mt.filter(t => t.type === 'expense'), t => t.amount);
    const low = items.filter(i => +i.qty <= +i.min);
    const open = fields.filter(f => f.status !== 'مكتمل');
    const t0 = new Date().toISOString().slice(0, 10);
    const harvest = open.filter(f => f.harvest).map(f => ({ f, d: Math.round((new Date(f.harvest) - new Date(t0)) / 864e5) })).sort((a, b) => a.d - b.d);
    const owed = (k) => sum(debts.filter(d => d.kind === k), d => (+d.amount || 0) - sum(d.pays || [], p => p.amount));
    return { S, cur, unit, fields, open, tx, items, low, workers, inc, exp, harvest, receivable: owed('receivable'), payable: owed('payable'), farm: S.farm || 'SME Agri', loc: S.loc, W: readWeather() };
  };

  const contextText = () => {
    const F = farmFacts(), L = [];
    L.push(`المزرعة: ${F.farm}${F.loc ? ' — ' + F.loc.name : ''}`);
    L.push(`الحقول (${F.fields.length}): ` + (F.fields.slice(0, 15).map(f => `${f.name} [${f.crop || '?'}، ${f.area || 0} ${F.unit}، حالة: ${f.status || '?'}${f.harvest ? '، حصاد: ' + f.harvest : ''}${f.irr ? '، ري: ' + f.irr : ''}]`).join('؛ ') || 'لا شيء'));
    L.push(`الشهر الحالي: إيرادات ${fmt(F.inc)} ${F.cur}، مصروفات ${fmt(F.exp)} ${F.cur}، صافي ${fmt(F.inc - F.exp)}`);
    L.push(`ديون لنا: ${fmt(F.receivable)}، ديون علينا: ${fmt(F.payable)}`);
    if (F.low.length) L.push('مخزون منخفض: ' + F.low.slice(0, 10).map(i => `${i.name} (${i.qty} ${i.unit || ''})`).join('، '));
    L.push(`عدد العمال الدائمين: ${F.workers.length}`);
    if (F.W && F.W.current) L.push(`الطقس الحالي: ${Math.round(F.W.current.temperature_2m)}°م، رياح ${Math.round(F.W.current.wind_speed_10m)} كم/س، رطوبة ${F.W.current.relative_humidity_2m}%`);
    return L.join('\n');
  };

  /* ---------------- قاعدة معرفة زراعية (تعمل بدون إنترنت) ---------------- */
  const KB = [
    { k: ['تسميد', 'سماد', 'npk', 'يوريا', 'fertili', 'engrais', 'تغذية'],
      ar: '🌱 <b>برنامج تسميد البطيخ والشمام (بالتنقيط):</b>\n• <b>التأسيس (أسبوع 1–2):</b> فوسفور عالٍ (ماب/حمض فوسفوريك) + هيوميك لتقوية الجذور.\n• <b>النمو الخضري (3–4):</b> NPK 20-20-20 مع قليل من اليوريا، وعناصر صغرى مخلبية (حديد، زنك).\n• <b>التزهير والعقد (5–6):</b> NPK عالي الفوسفور + نترات الكالسيوم + بورون. فصل الكالسيوم عن الفوسفات والكبريتات.\n• <b>التحجيم (7–9):</b> سلفات البوتاسيوم + مغنيسيوم، وإيقاف النيتروجين لرفع السكر.\n⚠️ حلّل التربة والماء أولاً؛ الكميات تُضبط حسب نتائج التحليل. (وحدة «الأسمدة» تحسب الجرعات لمساحتك)',
      fr: '🌱 <b>Fertilisation pastèque/melon (goutte-à-goutte) :</b>\n• <b>Installation (sem. 1–2) :</b> phosphore élevé + acides humiques.\n• <b>Croissance (3–4) :</b> NPK 20-20-20 + oligo-éléments chélatés.\n• <b>Floraison/nouaison (5–6) :</b> NPK riche en P, nitrate de calcium, bore. Ne jamais mélanger calcium avec sulfates/phosphates.\n• <b>Grossissement (7–9) :</b> sulfate de potasse + magnésium, stopper l’azote pour le sucre.' },
    { k: ['ري', 'سقي', 'ماء', 'تنقيط', 'irrig', 'arros', 'goutte'],
      ar: '💧 <b>الري في المناطق الحارة:</b>\n• الري بالتنقيط صباحاً مبكراً أو قبل الغروب، ونبضات قصيرة متكررة في الرمال.\n• زِد الكمية عند الحرارة فوق 36° وقلّلها تدريجياً عند نضج الثمار لرفع السكر ومنع التشقق.\n• تجنّب تذبذب الري قبل الحصاد (يسبب تشقق الثمار).\n• نظّف المرشحات أسبوعياً، واغسل الخطوط الفرعية بنهاياتها المفتوحة، وعالج الانسداد الكلسي بحمض أو كلور مخفف.\n• راقب ملوحة الماء (EC) فهي حرجة في وادي النهر.',
      fr: '💧 <b>Irrigation en zone chaude :</b>\n• Goutte-à-goutte tôt le matin ou fin d’après-midi, impulsions courtes en sol sableux.\n• Augmenter au-delà de 36 °C, réduire progressivement à maturité (sucre, éviter l’éclatement).\n• Nettoyer les filtres chaque semaine, purger les rampes, traiter le calcaire/chlore.\n• Surveiller la salinité (CE) de l’eau.' },
    { k: ['ذبابة', 'بيضاء', 'من ', 'حشر', 'آفات', 'آفة', 'عنكبوت', 'ثربس', 'دودة', 'pest', 'insect', 'ravageur', 'puceron', 'mouche'],
      ar: '🐛 <b>أهم آفات البطيخ والشمام:</b>\n• <b>الذبابة البيضاء والمنّ:</b> فحص أسفل الأوراق أسبوعياً، مصائد صفراء، تناوب المبيدات الجهازية بمجموعات مختلفة.\n• <b>العنكبوت الأحمر:</b> يزداد في الحر والغبار؛ رش ماء وكبريت ميكروني/أكاريسايد.\n• <b>الثربس:</b> مصائد زرقاء وفحص الأزهار.\n• <b>دودة الثمار والحفار:</b> طُعوم ومصائد فرمونية.\n✅ التزم بملصق المبيد وفترة ما قبل الحصاد، وبدّل مجموعات المبيدات لتجنب المقاومة.',
      fr: '🐛 <b>Principaux ravageurs :</b> aleurodes et pucerons (pièges jaunes, rotation des familles), acariens (soufre mouillable), thrips (pièges bleus), noctuelles. Respecter l’étiquette et le délai avant récolte.' },
    { k: ['بياض', 'مرض', 'مراض', 'امراض', 'فطر', 'ذبول', 'عفن', 'تبقع', 'maladie', 'mildiou', 'oïdium', 'fusar', 'pourriture', 'disease'],
      ar: '🍂 <b>أمراض شائعة:</b>\n• <b>البياض الدقيقي:</b> بقع بيضاء مسحوقية؛ كبريت ميكروني وتهوية ومنع الإفراط في النيتروجين.\n• <b>البياض الزغبي:</b> بقع صفراء تحتها زغب رمادي مع الرطوبة؛ مبيدات وقائية نحاسية وتقليل رطوبة الأوراق.\n• <b>ذبول الفيوزاريوم:</b> ذبول مفاجئ من التربة؛ تناوب زراعي (4 سنوات)، شتلات مطعّمة، تعقيم التربة.\n• <b>لفحة الساق الصمغية:</b> تقرّحات صمغية على الساق؛ تهوية ومعاملات وقائية.\n📌 صوّر العرض واكتب وصفه لأساعدك في التشخيص.',
      fr: '🍂 <b>Maladies :</b> oïdium (soufre, aération), mildiou (cuivre préventif), fusariose (rotation, plants greffés), chancre gommeux de la tige. Décrivez les symptômes pour un diagnostic.' },
    { k: ['حصاد', 'نضج', 'قطف', 'جني', 'récolte', 'maturité', 'harvest', 'ripe'],
      ar: '🍉 <b>علامات النضج:</b>\n• <b>البطيخ:</b> جفاف المحلاق المجاور للثمرة، تحوّل بقعة الملامسة للأرض إلى أصفر كريمي، وصوت أجوف عند النقر.\n• <b>الشمام الشبكي:</b> انفصال الثمرة بسهولة عن العنق (Slip)، وتحوّل لون الخلفية وظهور الرائحة العطرية.\n• اقطف صباحاً مبكراً وظلّل الثمار بعد القطف وتجنّب الرمي والصدمات.\n• أوقف الري 3–5 أيام قبل الحصاد لرفع السكر.',
      fr: '🍉 <b>Maturité :</b> pastèque : vrille sèche, tache de sol jaune crème, son creux. Melon : détachement facile du pédoncule, arôme. Récolter tôt le matin, éviter les chocs, stopper l’irrigation 3–5 jours avant.' },
    { k: ['ملوحة', 'ملح', 'قلوية', 'ph', 'تربة', 'رمل', 'salin', 'sol ', 'salinité'],
      ar: '🧂 <b>الملوحة والتربة:</b>\n• اقِس EC للماء والتربة؛ البطيخ متوسط التحمل (حتى ~2.5 dS/م دون خسارة كبيرة).\n• اغسل الأملاح بريّة إضافية دورية، وتجنّب الري الخفيف المتكرر بماء مالح.\n• أضف مادة عضوية وجبس زراعي عند ارتفاع الصوديوم.\n• التربة الرملية تحتاج تسميداً أكثر تكراراً وبجرعات أقل.',
      fr: '🧂 <b>Salinité :</b> mesurer la CE de l’eau et du sol (pastèque : tolérance moyenne), lessivage périodique, matière organique et gypse si sodicité, fertigation fractionnée en sol sableux.' },
    { k: ['تلقيح', 'نحل', 'عقد', 'تساقط', 'أزهار', 'pollin', 'abeille', 'nouaison'],
      ar: '🐝 <b>التلقيح والعقد:</b> ضع 3–5 خلايا نحل للهكتار عند بدء التزهير، وتجنّب رش المبيدات نهاراً أثناء نشاط النحل. تساقط الأزهار غالباً بسبب الحرارة الشديدة، نقص البورون/الكالسيوم، أو الإفراط في النيتروجين.',
      fr: '🐝 <b>Pollinisation :</b> 3–5 ruches/ha à la floraison, pas de traitement en journée. Chute de fleurs : chaleur, carence en bore/calcium, excès d’azote.' },
    { k: ['زراعة', 'مسافة', 'بذور', 'شتل', 'كثافة', 'تباعد', 'semis', 'plantation', 'densité', 'planting'],
      ar: '🌾 <b>الزراعة:</b> المسافة المعتادة للبطيخ 1.5–2 م بين الخطوط و0.6–0.9 م بين النباتات (≈ 7000–10000 نبتة/هكتار). الشمام أقرب قليلاً. استخدم الغطاء البلاستيكي (Mulch) لتقليل الأعشاب والتبخر، واحرص على تناوب المحاصيل.',
      fr: '🌾 <b>Plantation :</b> pastèque 1,5–2 m entre lignes × 0,6–0,9 m (≈ 7000–10000 plants/ha). Paillage plastique recommandé, rotation des cultures.' },
    { k: ['حرارة', 'حر', 'رياح', 'غبار', 'صقيع', 'chaleur', 'vent', 'canicule'],
      ar: '🔥 <b>الحر والرياح:</b> في الحرارة العالية زِد الري وظلّل الثمار بالأوراق، وتجنّب الرش الورقي وقت الظهيرة أو عند رياح فوق 25 كم/س. الرياح الرملية تُتلف الشتلات الصغيرة: استخدم مصدّات رياح أو أنفاق.',
      fr: '🔥 <b>Chaleur/vent :</b> irriguer davantage, ombrer les fruits, pas de traitement foliaire à midi ou vent > 25 km/h, brise-vent pour les jeunes plants.' },
    { k: ['تسويق', 'بيع', 'سعر', 'تخزين', 'تعبئة', 'تصدير', 'marché', 'vente', 'prix', 'export'],
      ar: '🛒 <b>التسويق:</b> سجّل كل شحنة وفاتورة فوراً، وحدّد سعر التعادل (تكلفة الكيلو) قبل التفاوض. اجمع العروض من أكثر من تاجر، ونسّق الحصاد مع موعد الشحن لتقليل الفاقد. استخدم وحدة «الفوترة» لإصدار فاتورة PDF للعميل.',
      fr: '🛒 <b>Commercialisation :</b> facturer chaque expédition, connaître le coût de revient/kg, comparer plusieurs acheteurs, synchroniser récolte et transport.' },
    { k: ['عمال', 'عمالة', 'راتب', 'إدارة', 'تكلف', 'ربح', 'نصيحة', 'main-d', 'gestion', 'coût', 'travailleur'],
      ar: '📊 <b>نصائح إدارية:</b> راقب تكلفة الهكتار (عمالة + أسمدة + ري + وقود) وقارنها بالإيراد المتوقع. سجّل الحضور بالبصمة وحدّد مهام يومية لكل فريق. افصل حساب المزرعة عن الحسابات الشخصية، وراجع الديون المستحقة أسبوعياً.',
      fr: '📊 <b>Gestion :</b> suivre le coût/ha (main-d’œuvre, engrais, eau, carburant), pointer les présences, séparer comptes personnels et ferme, relancer les créances chaque semaine.' }
  ];

  const isFrench = (q) => /[éèêàçùôîï]|\b(quel|quelle|comment|pour|les|des|est|mes|ma|mon|combien|bonjour|je|vous)\b/i.test(q);

  const dataAnswer = (q, fr) => {
    const F = farmFacts(), t = q.toLowerCase();
    const money = (n) => `${fmt(n)} ${F.cur}`;
    if (/ملخص|حالة المزرعة|وضع|résumé|bilan|état/.test(t)) {
      const nextH = F.harvest[0];
      return fr
        ? `📋 <b>Résumé de ${esc(F.farm)} :</b>\n• ${F.fields.length} champ(s), ${fmt(sum(F.fields, f => f.area))} ${esc(F.unit)}\n• Ce mois : revenus ${money(F.inc)}, dépenses ${money(F.exp)}, net <b>${money(F.inc - F.exp)}</b>\n• Créances ${money(F.receivable)} / dettes ${money(F.payable)}\n• Stocks bas : ${F.low.length}`
        : `📋 <b>ملخص ${esc(F.farm)}:</b>\n• ${F.fields.length} حقل بمساحة ${fmt(sum(F.fields, f => f.area))} ${esc(F.unit)} (${F.open.length} نشط)\n• هذا الشهر: إيرادات ${money(F.inc)}، مصروفات ${money(F.exp)}، الصافي <b>${money(F.inc - F.exp)}</b>\n• ديون لنا ${money(F.receivable)} | ديون علينا ${money(F.payable)}\n• أصناف مخزون منخفضة: ${F.low.length}${nextH ? `\n• أقرب حصاد: ${esc(nextH.f.name)} ${nextH.d < 0 ? 'متأخر ' + (-nextH.d) + ' يوم' : 'بعد ' + nextH.d + ' يوم'}` : ''}`;
    }
    if (/حقل|حقول|مساح|champ|surface|parcelle/.test(t) && /كم|عدد|مساح|combien|surface|liste|قائمة|أين|ما هي|what|quels/.test(t)) {
      if (!F.fields.length) return fr ? 'Aucun champ enregistré pour le moment.' : 'لا توجد حقول مسجلة بعد. أضفها من «الحقول والمحاصيل» أو ارسمها على «الخريطة».';
      return (fr ? '🌱 <b>Vos champs :</b>\n' : '🌱 <b>حقولك:</b>\n') + F.fields.slice(0, 15).map(f => `• ${esc(f.name)} — ${esc(f.crop || '')} — ${fmt(f.area)} ${esc(F.unit)} (${esc(f.status || '')})`).join('\n') + `\n<b>${fr ? 'Total' : 'الإجمالي'}: ${fmt(sum(F.fields, f => f.area))} ${esc(F.unit)}</b>`;
    }
    if (/ربح|رباح|إيراد|ايراد|مصروف|دخل|مبيعات|خسار|bénéfice|revenu|dépense|vente|profit/.test(t)) {
      const net = F.inc - F.exp;
      return fr ? `💰 <b>Ce mois :</b> revenus ${money(F.inc)}, dépenses ${money(F.exp)}, résultat <b>${money(net)}</b> ${net < 0 ? '⚠️ (déficit)' : '✅'}`
        : `💰 <b>هذا الشهر:</b> الإيرادات ${money(F.inc)}، المصروفات ${money(F.exp)}، الصافي <b>${money(net)}</b> ${net < 0 ? '⚠️ (عجز — راجع المصروفات الكبرى)' : '✅'}`;
    }
    if (/مخزون|نقص|مخزن|stock|rupture/.test(t)) {
      if (!F.low.length) return fr ? '📦 Aucun stock sous le seuil.' : '📦 لا توجد أصناف أقل من حد التنبيه حالياً.';
      return (fr ? '📦 <b>Stocks bas :</b>\n' : '📦 <b>أصناف تحتاج توريداً:</b>\n') + F.low.map(i => `• ${esc(i.name)}: ${fmt(i.qty)} ${esc(i.unit || '')} (${fr ? 'seuil' : 'الحد'} ${fmt(i.min)})`).join('\n');
    }
    if (/موعد الحصاد|مواعيد.*حصاد|متى.*حصاد|أقرب حصاد|prochaine récolte|quand.*récolte/.test(t)) {
      if (!F.harvest.length) return fr ? 'Aucune date de récolte enregistrée.' : 'لا توجد مواعيد حصاد مسجلة في الحقول.';
      return (fr ? '🌾 <b>Récoltes :</b>\n' : '🌾 <b>مواعيد الحصاد:</b>\n') + F.harvest.slice(0, 8).map(h => `• ${esc(h.f.name)} (${esc(h.f.crop || '')}) — ${h.f.harvest} — ${h.d < 0 ? (fr ? 'en retard de ' : 'متأخر ') + (-h.d) + (fr ? ' j' : ' يوم') : (fr ? 'dans ' : 'بعد ') + h.d + (fr ? ' j' : ' يوم')}`).join('\n');
    }
    if (/طقس|حرارة اليوم|الجو|météo|temps|weather/.test(t) && F.W && F.W.current) {
      const c = F.W.current, tmp = Math.round(c.temperature_2m), wd = Math.round(c.wind_speed_10m);
      const adv = tmp >= 36 ? (fr ? 'Chaleur forte : allongez l’irrigation.' : 'حرارة عالية: زد وقت الري وظلّل الثمار.') : wd >= 25 ? (fr ? 'Vent fort : évitez les pulvérisations.' : 'رياح نشطة: تجنّب الرش الورقي.') : (fr ? 'Conditions normales.' : 'ظروف اعتيادية: ري صباحي.');
      return `⛅ ${tmp}°C | ${wd} km/h | ${c.relative_humidity_2m}%\n${adv}`;
    }
    if (/عمال|عامل|travailleur|ouvrier/.test(t) && /كم|عدد|combien/.test(t)) return fr ? `👷 ${F.workers.length} travailleur(s) permanent(s).` : `👷 عدد العمال الدائمين: ${F.workers.length}.`;
    if (/ديون|دين|مستحق|créance|dette/.test(t)) return fr ? `🧾 Créances : ${money(F.receivable)} — Dettes : ${money(F.payable)}` : `🧾 مستحقات لنا: ${money(F.receivable)} — مستحقات علينا: ${money(F.payable)}`;
    return null;
  };

  const builtIn = (q) => {
    const fr = isFrench(q), t = q.toLowerCase();
    const d = dataAnswer(q, fr);
    if (d) return d;
    let best = null, bs = 0;
    KB.forEach(e => { const s = e.k.reduce((a, k) => a + (t.includes(k) ? k.length : 0), 0); if (s > bs) { bs = s; best = e; } });
    if (best) return fr && best.fr ? best.fr : best.ar;
    return fr
      ? '🤖 Je peux répondre sur la fertilisation, l’irrigation, les ravageurs, les maladies, la récolte, et sur <b>vos données</b> (champs, finances, stocks). Pour des réponses libres, ajoutez une clé Gemini avec le bouton 🔑.'
      : '🤖 أستطيع الإجابة عن التسميد والري والآفات والأمراض والحصاد، وعن <b>بيانات مزرعتك</b> (الحقول، الحسابات، المخزون، مواعيد الحصاد). لأسئلة مفتوحة أكثر أضف مفتاح Gemini المجاني بزر 🔑.';
  };

  /* ---------------- عرض نص منسّق بأمان ---------------- */
  const renderText = (txt) => esc(txt)
    .replace(/\*\*(.+?)\*\*/g, '<b>$1</b>')
    .replace(/^\s*[\*\-] /gm, '• ')
    .replace(/^#{1,4} (.+)$/gm, '<b>$1</b>');

  onReady(() => {
    if (document.getElementById('smeAiBtn')) return;

    const aiBtn = document.createElement('button');
    aiBtn.id = 'smeAiBtn';
    aiBtn.innerHTML = '🤖 المساعد الذكي';
    aiBtn.style.cssText = 'position:fixed; bottom:78px; right:16px; z-index:9998; background:#1a3622; color:#fff; border:2px solid #d97706; border-radius:25px; padding:10px 18px; font-weight:bold; font-size:14px; box-shadow:0 4px 12px rgba(0,0,0,0.25); cursor:pointer; font-family:inherit;';
    document.body.appendChild(aiBtn);

    const modal = document.createElement('div');
    modal.style.cssText = 'display:none; position:fixed; inset:0; background:rgba(0,0,0,0.65); z-index:9999; padding:12px; direction:rtl;';
    const quick = [['📋 ملخص مزرعتي', 'ملخص مزرعتي'], ['💰 أرباح الشهر', 'كم الأرباح هذا الشهر؟'], ['📦 نقص المخزون', 'ما الأصناف الناقصة في المخزون؟'], ['🌾 مواعيد الحصاد', 'ما هي مواعيد الحصاد؟'], ['⛅ الطقس', 'كيف الطقس اليوم؟'], ['🍉 تسميد', 'برنامج تسميد البطيخ'], ['💧 الري', 'برنامج الري'], ['🐛 الآفات', 'مكافحة الآفات'], ['🍂 الأمراض', 'أمراض البطيخ والشمام'], ['🧂 الملوحة', 'التعامل مع ملوحة التربة والماء']];
    modal.innerHTML = `
      <div style="background:#fff; border-radius:16px; max-width:520px; height:calc(100% - 24px); margin:0 auto; display:flex; flex-direction:column; overflow:hidden; box-shadow:0 10px 30px rgba(0,0,0,0.3); color:#1e293b;">
        <div style="background:#1a3622; color:#fff; padding:12px 14px; display:flex; justify-content:space-between; align-items:center; border-bottom:3px solid #d97706;">
          <div>
            <h3 style="margin:0; font-size:16px;">🤖 مستشار SME Agri الذكي</h3>
            <span id="aiStatus" style="font-size:11px; color:#fde68a;"></span>
          </div>
          <div style="display:flex; gap:6px;">
            <button id="clearAiBtn" title="مسح المحادثة" style="background:#475569; color:#fff; border:none; border-radius:8px; padding:5px 8px; font-size:12px; cursor:pointer;">🗑</button>
            <button id="toggleApiKeyBtn" title="مفتاح Gemini" style="background:#d97706; color:#fff; border:none; border-radius:8px; padding:5px 8px; font-size:12px; cursor:pointer;">🔑</button>
            <button id="closeAiModal" style="background:#ef4444; color:#fff; border:none; border-radius:8px; padding:5px 10px; font-weight:bold; cursor:pointer;">✕</button>
          </div>
        </div>
        <div id="apiKeyBox" style="display:none; background:#fef3c7; padding:10px; border-bottom:1px solid #fcd34d; font-size:12px;">
          <div style="font-weight:bold; color:#92400e; margin-bottom:4px;">مفتاح Google Gemini (مجاني من aistudio.google.com) — يفعّل الإجابة الحرة والمعرفة بمزرعتك:</div>
          <div style="display:flex; gap:6px;">
            <input id="geminiApiInput" type="password" placeholder="AIza..." style="flex:1; padding:6px; border:1px solid #cbd5e1; border-radius:6px;">
            <button id="saveApiKeyBtn" style="background:#1a3622; color:#fff; border:none; border-radius:6px; padding:0 12px; font-weight:bold; cursor:pointer;">حفظ</button>
          </div>
          <div style="margin-top:4px; color:#78350f;">المفتاح يُحفظ على جهازك فقط. تُرسل ملخصات مزرعتك إلى Google عند السؤال.</div>
        </div>
        <div id="aiChatBox" style="flex:1; padding:12px; overflow-y:auto; background:#f8fafc; display:flex; flex-direction:column; gap:10px;"></div>
        <div style="padding:8px 10px; background:#f1f5f9; display:flex; gap:6px; overflow-x:auto; border-top:1px solid #e2e8f0;">
          ${quick.map(q => `<button class="quick-q" data-q="${esc(q[1])}" style="white-space:nowrap; background:#fff; border:1px solid #cbd5e1; border-radius:15px; padding:5px 10px; font-size:11px; color:#1a3622; cursor:pointer;">${q[0]}</button>`).join('')}
        </div>
        <div style="padding:10px; background:#fff; border-top:1px solid #e2e8f0; display:flex; gap:8px;">
          <input id="aiUserInput" type="text" placeholder="اسأل بالعربية أو الفرنسية..." style="flex:1; padding:10px; border:1px solid #cbd5e1; border-radius:10px; font-size:14px;">
          <button id="aiSendBtn" style="background:#d97706; color:#fff; border:none; border-radius:10px; padding:0 16px; font-weight:bold; font-size:14px; cursor:pointer;">إرسال</button>
        </div>
      </div>`;
    document.body.appendChild(modal);

    const chatBox = document.getElementById('aiChatBox');
    const userInput = document.getElementById('aiUserInput');
    const apiBox = document.getElementById('apiKeyBox');
    const apiInput = document.getElementById('geminiApiInput');
    const status = document.getElementById('aiStatus');
    apiInput.value = lsGet('sme_gemini_key', '');

    let history = [];
    try { history = JSON.parse(lsGet(HIST_KEY, '[]')); if (!Array.isArray(history)) history = []; } catch (e) { history = []; }
    const saveHist = () => lsSet(HIST_KEY, JSON.stringify(history.slice(-40)));
    const updStatus = () => { status.textContent = lsGet('sme_gemini_key', '') ? '🟢 ذكاء متقدم (Gemini) + بيانات مزرعتك' : '🟡 مستشار مدمج يعمل بدون إنترنت — أضف 🔑 للذكاء المتقدم'; };

    const bubble = (html, isUser, raw) => {
      const m = document.createElement('div');
      m.style.cssText = isUser
        ? 'background:#1a3622; color:#fff; padding:10px 14px; border-radius:12px; font-size:13px; line-height:1.6; align-self:flex-end; max-width:88%; white-space:pre-line;'
        : 'background:#fff; border:1px solid #e2e8f0; color:#1e293b; padding:10px 14px; border-radius:12px; font-size:13px; line-height:1.7; align-self:flex-start; max-width:92%; white-space:pre-line;';
      if (raw) m.textContent = html; else m.innerHTML = html;
      chatBox.appendChild(m);
      chatBox.scrollTop = chatBox.scrollHeight;
      return m;
    };

    const welcome = () => {
      const F = farmFacts();
      bubble(`مرحباً بك في <strong>${esc(F.farm)}</strong>! 🌱<br>أعرف بيانات مزرعتك (${F.fields.length} حقل، الحسابات، المخزون، الحصاد) وأجيب عن الزراعة والإدارة بالعربية أو Français. جرّب الأزرار السريعة أسفل الشاشة.`, false);
    };
    const redraw = () => {
      chatBox.innerHTML = '';
      welcome();
      history.forEach(h => h.role === 'user' ? bubble(h.text, true, true) : bubble(h.html, false));
    };
    redraw(); updStatus();

    aiBtn.onclick = () => { modal.style.display = 'block'; updStatus(); chatBox.scrollTop = chatBox.scrollHeight; };
    document.getElementById('closeAiModal').onclick = () => { modal.style.display = 'none'; };
    document.getElementById('toggleApiKeyBtn').onclick = () => { apiBox.style.display = apiBox.style.display === 'none' ? 'block' : 'none'; };
    document.getElementById('saveApiKeyBtn').onclick = () => {
      lsSet('sme_gemini_key', apiInput.value.trim());
      apiBox.style.display = 'none'; updStatus();
      bubble(apiInput.value.trim() ? '✅ تم حفظ المفتاح. اسألني أي سؤال.' : 'تم حذف المفتاح، سأعمل بالمستشار المدمج.', false);
    };
    document.getElementById('clearAiBtn').onclick = () => { if (confirm('مسح المحادثة؟')) { history = []; saveHist(); redraw(); } };

    const callGemini = async (apiKey, question) => {
      const sys = `أنت مستشار زراعي وإداري خبير لشركة SME Agri (Société Moulay Ely Pour Agricol) المتخصصة في البطيخ الأحمر والشمام وخضروات أخرى في منطقة كرمسين بولاية اترارزة، موريتانيا (مناخ حار وجاف، تربة رملية، مياه من النهر/آبار، ري بالتنقيط).
أجب بنفس لغة السؤال (العربية أو الفرنسية) بإيجاز ووضوح وبخطوات عملية. استخدم بيانات المزرعة أدناه عند الحاجة ولا تخترع أرقاماً غير موجودة فيها؛ إن نقصت البيانات فاطلبها. لا تعطِ جرعات مبيدات دقيقة بلا ذكر قراءة ملصق المنتج وفترة ما قبل الحصاد. إن كان التشخيص غير مؤكد فاذكر الاحتمالات.
بيانات المزرعة الحالية:
${contextText()}`;
      const contents = history.filter(h => h.text).slice(-10).map(h => ({ role: h.role === 'user' ? 'user' : 'model', parts: [{ text: h.text }] }));
      contents.push({ role: 'user', parts: [{ text: question }] });
      const ctl = new AbortController(); const to = setTimeout(() => ctl.abort(), 30000);
      try {
        const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`, {
          method: 'POST', signal: ctl.signal,
          headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
          body: JSON.stringify({ systemInstruction: { parts: [{ text: sys }] }, contents, generationConfig: { temperature: 0.5, maxOutputTokens: 900 } })
        });
        const data = await res.json();
        if (data.error) throw new Error(data.error.message || ('HTTP ' + res.status));
        const parts = data.candidates && data.candidates[0] && data.candidates[0].content && data.candidates[0].content.parts;
        const txt = parts ? parts.map(p => p.text || '').join('') : '';
        if (!txt) throw new Error('رد فارغ');
        return txt;
      } finally { clearTimeout(to); }
    };

    let busy = false;
    const askAI = async (question) => {
      question = (question || '').trim();
      if (!question || busy) return;
      busy = true;
      bubble(question, true, true); userInput.value = '';
      const loading = bubble('⏳ جاري التفكير...', false);
      const apiKey = lsGet('sme_gemini_key', '');
      let html;
      // أسئلة البيانات الدقيقة تُجاب محلياً دائماً (أدق وأسرع)
      const local = dataAnswer(question, isFrench(question));
      if (local) html = local;
      else if (apiKey) {
        try { html = renderText(await callGemini(apiKey, question)); }
        catch (err) {
          const msg = /API key|API_KEY|permission|403|400/i.test(String(err.message)) ? 'المفتاح غير صالح أو غير مفعّل' : (err.name === 'AbortError' ? 'انتهت مهلة الاتصال' : 'تعذر الاتصال بالذكاء المتقدم');
          html = `<i style="color:#b45309">⚠️ ${esc(msg)} — هذه إجابة المستشار المدمج:</i>\n` + builtIn(question);
        }
      } else html = builtIn(question);
      loading.innerHTML = html;
      history.push({ role: 'user', text: question }, { role: 'model', html, text: loading.textContent });
      saveHist();
      chatBox.scrollTop = chatBox.scrollHeight;
      busy = false;
    };

    document.getElementById('aiSendBtn').onclick = () => askAI(userInput.value);
    userInput.onkeydown = (e) => { if (e.key === 'Enter') { e.preventDefault(); askAI(userInput.value); } };
    document.querySelectorAll('.quick-q').forEach(btn => { btn.onclick = () => askAI(btn.dataset.q); });
  });
})();
