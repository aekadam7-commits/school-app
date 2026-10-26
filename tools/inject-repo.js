// يضع اسم المستودع الحالي (owner/repo) داخل التطبيق عند البناء ليُولَّد كود QR تلقائيًا
const fs=require('fs'),path=require('path');
const repo=process.env.REPO||process.env.GITHUB_REPOSITORY;
if(!repo){console.log('inject-repo: no REPO, keeping default');process.exit(0)}
for(const p of ['www/index.html','server/public/index.html']){
  const f=path.join(__dirname,'..',p);
  let t=fs.readFileSync(f,'utf8');
  t=t.replace(/const APP_REPO='[^']*';/,"const APP_REPO='"+repo.replace(/[^\w.\/-]/g,'')+"';");
  fs.writeFileSync(f,t);
}
console.log('inject-repo: APP_REPO='+repo);
