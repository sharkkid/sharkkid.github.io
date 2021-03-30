// sw.js 文件
// install
self.addEventListener('install', event => {
    console.log('installing…');
});

// activate
self.addEventListener('activate', event => {
    console.log('now ready to handle fetches!');
});

// fetch
self.addEventListener('fetch', event => {
    console.log('now fetch!');
});

const SW = '[Service Worker]';
self.addEventListener('push', event => {
  console.log(`${SW} Push Received.`);
  console.log(`${SW} Push had this data: ${event.data.text()}`);
  const title = '推送好消息';
  const options = {
    body: '好消息報報'
    // icon: '',
    // badge: ''
  };  
  push(event,title,options);
});

async function push(event,title,options){
    while(true){
        if(event == null)
            event.waitUntil(self.registration.showNotification(title, options)) 
        else
            self.registration.showNotification(title, options)
        await new Promise(r => setTimeout(r, 2000));
    }    
}
