type EventName = 'season_view'|'team_change'|'season_change'|'play_season_start'|'play_season_complete'|'touchdown_select'|'type_filter'|'theme_toggle'|'help_open';
let context={team:'DET',season:2025};
let initialized=false;
declare global {interface Window {dataLayer?:IArguments[];}}
function gtag(..._args:unknown[]){(window.dataLayer??=[]).push(arguments);}
export function analyticsContext(team:string,season:number){context={team,season};}
/** Disabled without configuration. No application identifiers, cookies, or ad personalization. */
export function track(event:EventName, properties:{type?:string;playId?:string;theme?:string}={}) {
 const id=import.meta.env.VITE_GA_MEASUREMENT_ID;
 if(!/^G-[A-Z0-9]+$/.test(id??'') || navigator.doNotTrack==='1')return;
 if(!initialized){
  initialized=true;
  gtag('consent','default',{analytics_storage:'denied',ad_storage:'denied',ad_user_data:'denied',ad_personalization:'denied'});
  gtag('js',new Date());
  gtag('config',id,{send_page_view:false,allow_google_signals:false,allow_ad_personalization_signals:false,page_referrer:''});
  const script=document.createElement('script');script.async=true;script.src=`https://www.googletagmanager.com/gtag/js?id=${id}`;document.head.append(script);
 }
 gtag('event',event,{...context,...properties,page_location:`${location.origin}/${context.team}/${context.season}`,page_referrer:''});
}
