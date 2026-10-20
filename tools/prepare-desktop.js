const fs=require('fs'),path=require('path');
const root=path.join(__dirname,'..'),out=path.join(root,'desktop');
fs.rmSync(path.join(out,'server'),{recursive:true,force:true});
fs.mkdirSync(path.join(out,'server','public'),{recursive:true});
fs.copyFileSync(path.join(root,'server','server.js'),path.join(out,'server','server.js'));
fs.copyFileSync(path.join(root,'server','package.json'),path.join(out,'server','package.json'));
fs.copyFileSync(path.join(root,'www','index.html'),path.join(out,'server','public','index.html'));
console.log('Desktop files prepared');
