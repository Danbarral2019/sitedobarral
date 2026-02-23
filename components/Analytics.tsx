// Google Analytics — deferred via requestIdleCallback for best mobile+desktop perf
import Script from 'next/script';

export default function Analytics() {
  const gaId = process.env.NEXT_PUBLIC_GA_ID;

  if (!gaId || process.env.NODE_ENV !== 'production') {
    return null;
  }

  return (
    <Script id="google-analytics" strategy="afterInteractive">
      {`(function(id){function load(){var s=document.createElement('script');s.src='https://www.googletagmanager.com/gtag/js?id='+id;s.async=true;document.head.appendChild(s);window.dataLayer=window.dataLayer||[];function g(){dataLayer.push(arguments)}window.gtag=g;g('js',new Date());g('config',id)}if('requestIdleCallback' in window){requestIdleCallback(load)}else{setTimeout(load,2500)}})('${gaId}')`}
    </Script>
  );
}
