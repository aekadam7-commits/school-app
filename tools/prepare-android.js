const fs=require('fs'),path=require('path');
const root=path.join(__dirname,'..'), J=(...p)=>path.join(root,...p);
const read=p=>fs.readFileSync(p,'utf8'), write=(p,s)=>{fs.mkdirSync(path.dirname(p),{recursive:true});fs.writeFileSync(p,s)};
const step=process.argv[2];
if(step==='pre'){
  const tmp=J('.node-build'); fs.rmSync(tmp,{recursive:true,force:true}); fs.mkdirSync(tmp,{recursive:true});
  fs.cpSync(J('www'),path.join(tmp,'www'),{recursive:true});
  fs.copyFileSync(J('server','server.js'),path.join(tmp,'server.js'));
  fs.copyFileSync(J('server','package.json'),path.join(tmp,'package.json'));
  fs.rmSync(J('www','nodejs'),{recursive:true,force:true}); fs.renameSync(tmp,J('www','nodejs'));
  const cfg=JSON.parse(read(J('capacitor.config.json')));
  cfg.plugins={...(cfg.plugins||{}),CapacitorNodeJS:{nodeDir:'nodejs',startMode:'manual'},NodeJS:{nodeDir:'nodejs',startMode:'manual'}};
  cfg.server={...(cfg.server||{}),cleartext:true,androidScheme:"http"}; write(J('capacitor.config.json'),JSON.stringify(cfg,null,2));
  console.log('Android Node runtime prepared');
}
if(step==='post'){
  const appId=JSON.parse(read(J('capacitor.config.json'))).appId;
  const pkgDir=J('android','app','src','main','java',...appId.split('.'));
  const vars=J('android','variables.gradle');
  if(fs.existsSync(vars))write(vars,read(vars).replace(/minSdkVersion\s*=\s*\d+/,'minSdkVersion = 24'));
  write(path.join(pkgDir,'MainActivity.java'),`package ${appId};\nimport android.os.Bundle;\nimport com.getcapacitor.BridgeActivity;\npublic class MainActivity extends BridgeActivity { @Override public void onCreate(Bundle savedInstanceState) { registerPlugin(GhiyabatPlugin.class); super.onCreate(savedInstanceState); } }\n`);
  write(path.join(pkgDir,'GhiyabatService.java'),`package ${appId};
import android.app.*; import android.content.*; import android.content.pm.ServiceInfo; import android.os.*;
public class GhiyabatService extends Service {
 public int onStartCommand(Intent i,int f,int id){String ch="ghiyabat_server"; NotificationManager nm=(NotificationManager)getSystemService(NOTIFICATION_SERVICE); if(Build.VERSION.SDK_INT>=26)nm.createNotificationChannel(new NotificationChannel(ch,"Ghiyabat local server",NotificationManager.IMPORTANCE_LOW)); Notification.Builder b=Build.VERSION.SDK_INT>=26?new Notification.Builder(this,ch):new Notification.Builder(this); b.setContentTitle("تسيير غيابات التلاميذ").setContentText("السيرفر المحلي يعمل").setSmallIcon(android.R.drawable.stat_notify_sync).setOngoing(true); if(Build.VERSION.SDK_INT>=34)startForeground(1,b.build(),ServiceInfo.FOREGROUND_SERVICE_TYPE_SPECIAL_USE);else startForeground(1,b.build()); return START_STICKY; }
 public IBinder onBind(Intent i){return null;}
}`);
  write(path.join(pkgDir,'GhiyabatPlugin.java'),`package ${appId};
import android.content.*; import android.os.Build; import com.getcapacitor.*; import com.getcapacitor.annotation.*; import android.print.PrintAttributes; import android.print.PrintDocumentAdapter; import android.print.PrintManager; import android.webkit.WebView; import android.webkit.WebViewClient;
@CapacitorPlugin(name="GhiyabatService") public class GhiyabatPlugin extends Plugin {
 @PluginMethod public void start(PluginCall call){Intent i=new Intent(getContext(),GhiyabatService.class);if(Build.VERSION.SDK_INT>=26)getContext().startForegroundService(i);else getContext().startService(i);call.resolve();}
 @PluginMethod public void stop(PluginCall call){getContext().stopService(new Intent(getContext(),GhiyabatService.class));call.resolve();}
 private WebView printWv;
 @PluginMethod public void printHtml(final PluginCall call){
  final String html=call.getString("html",""); final String name=call.getString("name","document"); final boolean land=Boolean.TRUE.equals(call.getBoolean("landscape",false));
  getActivity().runOnUiThread(new Runnable(){ public void run(){
   try{
    printWv=new WebView(getActivity());
    printWv.setWebViewClient(new WebViewClient(){ public void onPageFinished(WebView v,String u){
     try{
      PrintManager pm=(PrintManager)getActivity().getSystemService(Context.PRINT_SERVICE);
      PrintDocumentAdapter ad=v.createPrintDocumentAdapter(name);
      PrintAttributes.MediaSize ms=land?PrintAttributes.MediaSize.ISO_A4.asLandscape():PrintAttributes.MediaSize.ISO_A4;
      pm.print(name,ad,new PrintAttributes.Builder().setMediaSize(ms).setMinMargins(new PrintAttributes.Margins(400,400,400,400)).build());
      call.resolve();
     }catch(Exception e){call.reject(String.valueOf(e.getMessage()));}
    }});
    printWv.loadDataWithBaseURL(null,html,"text/html","UTF-8",null);
   }catch(Exception e){call.reject(String.valueOf(e.getMessage()));}
  }});
 }
}`);
  const res=J('android','app','src','main','res'), src=J('tools','android-icons');
  if(fs.existsSync(src)){
    for(const d of fs.readdirSync(src)){fs.mkdirSync(path.join(res,d),{recursive:true});for(const f of fs.readdirSync(path.join(src,d)))fs.copyFileSync(path.join(src,d,f),path.join(res,d,f));}
    fs.rmSync(path.join(res,'mipmap-anydpi-v26'),{recursive:true,force:true});
    console.log('Android launcher icons installed');
  }
  const mf=J('android','app','src','main','AndroidManifest.xml'); let m=read(mf);
  const perms=['android.permission.INTERNET','android.permission.ACCESS_NETWORK_STATE','android.permission.FOREGROUND_SERVICE','android.permission.FOREGROUND_SERVICE_SPECIAL_USE','android.permission.WAKE_LOCK','android.permission.CAMERA'];
  const add=perms.filter(p=>!m.includes('"'+p+'"')).map(p=>`    <uses-permission android:name="${p}" />`).join('\n');
  if(add)m=m.replace(/<application/,add+'\n    <application');
  if(!m.includes('usesCleartextTraffic'))m=m.replace(/<application/,'<application android:usesCleartextTraffic="true"');
  if(!m.includes('.GhiyabatService'))m=m.replace('</application>','<service android:name=".GhiyabatService" android:exported="false" android:foregroundServiceType="specialUse"><property android:name="android.app.PROPERTY_SPECIAL_USE_FGS_SUBTYPE" android:value="local-network-server" /></service>\n</application>');
  write(mf,m); console.log('Android manifest and service prepared');
}
