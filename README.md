# تسيير غيابات التلاميذ (Ghiyabat) 🎓

تطبيق متكامل لتسيير غيابات التلاميذ في المؤسسات التعليمية، يعمل بدون إنترنت (Offline-First)، مع دعم سطح المكتب (Windows) والهواتف (Android).

![GitHub release (latest by date)](https://img.shields.io/github/v/release/aekadam7-commits/school-app)
![GitHub Workflow Status](https://img.shields.io/github/actions/workflow/status/aekadam7-commits/school-app/build.yml)
![GitHub license](https://img.shields.io/github/license/aekadam7-commits/school-app)

## 📥 التحميل
يمكنك تحميل أحدث إصدار من التطبيق من صفحة [Releases](../../releases):
- 📱 **أندرويد:** `Ghiyabat.apk`
- 💻 **ويندوز:** `Ghiyabat-Setup-1.0.0.exe`

## ✨ الميزات الرئيسية
- **مزامنة محلية:** يعمل التطبيق كسيرفر محلي في الشبكة، مما يسمح للمشرفين بالتسجيل من أجهزتهم ومزامنة البيانات فوراً.
- **بدون إنترنت:** جميع البيانات محفوظة محلياً على جهازك.
- **إدارة الإشعارات:** إشعارات تلقائية لأولياء الأمور (واتساب/SMS) بناءً على عتبات الغياب.
- **استيراد وتصدير:** دعم كامل لملفات Excel.
- **التقارير والطباعة:** كشف شهري، تقارير الحصص الضائعة، وإمكانية الطباعة المباشرة.

## 🛠️ للمطورين (بناء التطبيق)
تم إعداد المستودع لبناء التطبيقات تلقائياً عبر GitHub Actions.
1. اذهب إلى تبويب **Actions**.
2. اختر `Build Ghiyabat APK and EXE`.
3. اضغط على `Run workflow`.
4. بعد الانتهاء، ستجد الملفات في صفحة **Releases**.

## 🔒 الأمان
يرجى مراجعة [سياسة الأمان](SECURITY.md) للإبلاغ عن أي ثغرات.

## 📄 الرخصة
هذا المشروع مرخص تحت رخصة MIT - راجع ملف [LICENSE](LICENSE) للتفاصيل.

## مشاركة التطبيق عبر كود QR

عند كل بناء ناجح يُنشئ GitHub Actions إصدارًا جديدًا (Release) يحوي الملفين `Ghiyabat.apk` و`Ghiyabat-QR.png`.
الصورة `Ghiyabat-QR.png` تحمل الرابط الثابت التالي، وعند مسحها بكاميرا الهاتف يبدأ تحميل أحدث نسخة من الـ APK مباشرة:

`https://github.com/<حسابك>/<المستودع>/releases/latest/download/Ghiyabat.apk`

نزّل الصورة من صفحة آخر Release وانشرها أو اطبعها. بعد التحميل يسمح المستخدم بـ «التثبيت من مصادر غير معروفة» لمتصفحه.
