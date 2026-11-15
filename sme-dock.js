(function() {
  // (أُزيل إطلاق DOMContentLoaded المصطنع: كان يعيد تشغيل الوحدات فتتكرر الأزرار وشريط الطقس.
  //  الوحدات الآن تتحقق من readyState وتعمل مباشرة إن كانت الصفحة جاهزة.)

  const createProDock = () => {
    if (document.getElementById('smeMasterDockBtn')) return;

    // 2. زر الأدوات المتقدمة الموحد
    const masterBtn = document.createElement('button');
    masterBtn.id = 'smeMasterDockBtn';
    masterBtn.innerHTML = '⚡ أدوات SME Pro';
    masterBtn.style.cssText = 'position:fixed; bottom:74px; left:14px; z-index:999999; background:linear-gradient(135deg, #1a3622 0%, #d97706 100%); color:#fff; border:2px solid #fff; border-radius:30px; padding:10px 18px; font-weight:bold; font-size:13px; box-shadow:0 6px 20px rgba(0,0,0,0.45); cursor:pointer; font-family:inherit; display:flex; align-items:center; gap:6px;';
    document.documentElement.appendChild(masterBtn);

    // 3. القائمة المنبثقة للأدوات
    const menuBox = document.createElement('div');
    menuBox.id = 'smeMasterMenu';
    menuBox.style.cssText = 'display:none; position:fixed; bottom:125px; left:14px; z-index:999999; background:#ffffff; border:2px solid #1a3622; border-radius:16px; padding:12px; width:245px; box-shadow:0 15px 35px rgba(0,0,0,0.4); direction:rtl; font-family:inherit;';
    menuBox.innerHTML = `
      <div style="font-weight:bold; color:#1a3622; font-size:13px; border-bottom:1px solid #e2e8f0; padding-bottom:6px; margin-bottom:8px; display:flex; justify-content:space-between;">
        <span>🌟 الأدوات المتقدمة</span>
        <span id="closeMasterMenu" style="color:#ef4444; cursor:pointer; padding:0 5px;">✕</span>
      </div>
      <div style="display:flex; flex-direction:column; gap:7px;">
        <button id="dockOpenMap" style="background:#1e3a8a; color:#fff; border:none; border-radius:8px; padding:10px; font-size:12px; font-weight:bold; text-align:right; cursor:pointer;">🗺️ خريطة الحقول وشبكة الري</button>
        <button id="dockOpenFert" style="background:#065f46; color:#fff; border:none; border-radius:8px; padding:10px; font-size:12px; font-weight:bold; text-align:right; cursor:pointer;">🧪 الأسمدة وحاسبة الجرعات</button>
        <button id="dockOpenInv" style="background:#d97706; color:#fff; border:none; border-radius:8px; padding:10px; font-size:12px; font-weight:bold; text-align:right; cursor:pointer;">🧾 الفوترة (عربي / Français)</button>
        <button id="dockOpenPro" style="background:#0f172a; color:#fde68a; border:none; border-radius:8px; padding:10px; font-size:12px; font-weight:bold; text-align:right; cursor:pointer;">📊 الإدارة الذكية والأرشيف</button>
        <button id="dockOpenAi" style="background:#1a3622; color:#fff; border:none; border-radius:8px; padding:10px; font-size:12px; font-weight:bold; text-align:right; cursor:pointer;">🤖 مستشار SME Agri الذكي</button>
      </div>
    `;
    document.documentElement.appendChild(menuBox);

    masterBtn.onclick = () => {
      menuBox.style.display = menuBox.style.display === 'none' ? 'block' : 'none';
    };
    document.getElementById('closeMasterMenu').onclick = () => {
      menuBox.style.display = 'none';
    };

    // دالة تشغيل الوحدات ورفع نافذتها لأعلى الشاشة
    const launchModule = (keywords) => {
      menuBox.style.display = 'none';
      const allBtns = Array.from(document.querySelectorAll('button'));
      const target = allBtns.find(b => 
        !b.id.startsWith('dock') && 
        b.id !== 'smeMasterDockBtn' && 
        keywords.some(k => b.innerText && b.innerText.includes(k))
      );

      if (target) {
        target.click();
        setTimeout(() => {
          document.querySelectorAll('div').forEach(d => {
            if (d.style && d.style.position === 'fixed' && d.style.display !== 'none' && d.id !== 'smeMasterMenu') {
              d.style.zIndex = '9999999';
            }
          });
        }, 120);
      } else {
        alert('⚠️ هذه الوحدة غير محمّلة بعد، أعد المحاولة بعد لحظات.');
      }
    };

    document.getElementById('dockOpenMap').onclick = () => { document.getElementById('smeMasterMenu').style.display = 'none'; if (typeof go === 'function') go('map'); };
    document.getElementById('dockOpenFert').onclick = () => launchModule(['الأسمدة', 'التسميد']);
    document.getElementById('dockOpenInv').onclick = () => launchModule(['الفوترة', 'Facturation']);
    document.getElementById('dockOpenPro').onclick = () => launchModule(['الإدارة الذكية']);
    document.getElementById('dockOpenAi').onclick = () => launchModule(['المساعد الذكي']);

    // إخفاء الأزرار الفردية العائمة ليبقى التصميم نظيفاً
    setInterval(() => {
      document.querySelectorAll('button').forEach(b => {
        if (!b.id.startsWith('dock') && b.id !== 'smeMasterDockBtn' && b.style.position === 'fixed') {
          if (['الفوترة', 'Facturation', 'الإدارة الذكية', 'الأسمدة', 'خريطة الحقول', 'المساعد الذكي'].some(k => b.innerText.includes(k))) {
            b.style.opacity = '0';
            b.style.pointerEvents = 'none';
          }
        }
      });
    }, 1000);
  };

  setTimeout(createProDock, 800);
})();
