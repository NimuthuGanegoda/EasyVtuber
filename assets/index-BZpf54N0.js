import{r as e}from"./rolldown-runtime-QTnfLwEv.js";import{n as t,r as n,t as r}from"./vendor-react-CCT5uNyo.js";import{a as i,i as a,n as o,r as s,t as c}from"./vendor-ai-core-DLPL93U4.js";import{a as l,c as u,i as d,n as f,o as p,r as m,s as h,t as g}from"./vendor-firebase-V0hnkOmV.js";(function(){let e=document.createElement(`link`).relList;if(e&&e.supports&&e.supports(`modulepreload`))return;for(let e of document.querySelectorAll(`link[rel="modulepreload"]`))n(e);new MutationObserver(e=>{for(let t of e)if(t.type===`childList`)for(let e of t.addedNodes)e.tagName===`LINK`&&e.rel===`modulepreload`&&n(e)}).observe(document,{childList:!0,subtree:!0});function t(e){let t={};return e.integrity&&(t.integrity=e.integrity),e.referrerPolicy&&(t.referrerPolicy=e.referrerPolicy),e.crossOrigin===`use-credentials`?t.credentials=`include`:e.crossOrigin===`anonymous`?t.credentials=`omit`:t.credentials=`same-origin`,t}function n(e){if(e.ep)return;e.ep=!0;let n=t(e);fetch(e.href,n)}})();var _=e(n()),v=e(t()),y=13,b=14,x=78,S=409,C=375,w=386,T=374,E=263,D=382,O=159,k=145,A=33,j=155,M=[474,475,476,477],N=[469,470,471,472];function P(e,t){return Math.sqrt((e.x-t.x)**2+(e.y-t.y)**2+(e.z-t.z)**2)}function F(e,t){let n=t===`left`?M:N,r=0,i=0,a=0;return n.forEach(t=>{r+=e[t].x,i+=e[t].y,a+=e[t].z}),{x:r/n.length,y:i/n.length,z:a/n.length}}function I(e){let t=F(e,`right`),n=F(e,`left`),r=e[y].y-e[b].y,i=e[x].x-(e[S].x+e[C].x)/2,a=Math.abs(r/i),o=Math.atan2(e[197].y-e[9].y,e[197].z-e[9].z),s=Math.atan2(e[w].z-e[O].z,e[w].x-e[O].x),c=Math.atan2(e[9].y-e[152].y,e[9].x-e[152].x),l=P(e[w],e[T]),u=P(e[D],e[E]),d=P(e[O],e[k]),f=P(e[j],e[A]),p=Math.sqrt((n.x-e[w].x)**2+(n.y-e[w].y)**2),m=Math.sqrt((n.x-e[D].x)**2+(n.y-e[D].y)**2),h=Math.sqrt((t.x-e[O].x)**2+(t.y-e[O].y)**2),g=Math.sqrt((t.x-e[j].x)**2+(t.y-e[j].y)**2),_=(m/u+g/f-1)*3,v=(p/l+h/d-1)*3;return{eyeLHTemp:1-2*(e[k].y-e[O].y)/(e[A].x-e[j].x),eyeRHTemp:1-2*(e[T].y-e[w].y)/(e[E].x-e[D].x),mouthRatio:a,eyeYRatio:v,eyeXRatio:_,xAngle:o,yAngle:s,zAngle:c}}var L=`./data/`,R=`https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.35/wasm`;function z(){let[e,t]=(0,_.useState)(`System Idle`),[n,r]=(0,_.useState)(!1),[l,u]=(0,_.useState)(null),[d,f]=(0,_.useState)(0),[p,m]=(0,_.useState)(0),[h,g]=(0,_.useState)(0),v=(0,_.useRef)(null),y=(0,_.useRef)(null),b=(0,_.useRef)(null),x=(0,_.useRef)(null),S=(0,_.useRef)(),C=async e=>{let n=performance.now();try{t(`Initializing Neural Engines...`),g(10);let[l]=await Promise.all([o.forVisionTasks(R),a(),i(`webgl`)]);t(`Synchronizing Neural Cores...`),g(30);let u=`lambda_chan`,[d,f,p]=await Promise.all([c.createFromOptions(l,{baseOptions:{modelAssetPath:`${L}face_landmarker.task`,delegate:`GPU`},outputFaceBlendshapes:!0,runningMode:`VIDEO`,numFaces:1}),s(`${L}${u}/face_morpher.json`).catch(()=>null),s(`${L}${u}/body_morpher.json`).catch(()=>null)]);v.current=d,y.current=f,b.current=p,!f||!p?(console.warn(`Neural Core models missing. Entering Tracking-Only mode.`),t(`Tracking Only Mode Active`)):t(`Elite Core Synchronized`),g(80),t(`Calibrating Optical Input...`),e.srcObject=await navigator.mediaDevices.getUserMedia({video:{width:{ideal:640},height:{ideal:480},frameRate:{ideal:30}}}),e.onloadedmetadata=()=>{e.play(),x.current=e,r(!0),g(100),t(`Eternity Initiated in ${((performance.now()-n)/1e3).toFixed(2)}s`),S.current=requestAnimationFrame(w)}}catch(e){console.error(`Boot Failure:`,e),u(`Boot Failure: ${e.message}`),t(`System Restoration Required`)}},w=async()=>{if(!x.current||!v.current)return;let e=performance.now(),t=v.current.detectForVideo(x.current,e);t.faceLandmarks&&t.faceLandmarks.length>0&&I(t.faceLandmarks[0]);let n=performance.now();f(Math.round(n-e)),m(Math.round(1e3/(n-e))),S.current=requestAnimationFrame(w)};return(0,_.useEffect)(()=>()=>{S.current&&cancelAnimationFrame(S.current)},[]),{init:C,status:e,isLoaded:n,error:l,inferenceTime:d,fps:p}}var B=u({apiKey:`placeholder-key`,authDomain:`easyvtuber.firebaseapp.com`,projectId:`easyvtuber`,storageBucket:`easyvtuber.appspot.com`,messagingSenderId:`000000000000`,appId:`1:000000000000:web:000000000000`}),V=d(B);g(B);var H=r(),U=(0,_.createContext)({user:null,loading:!0}),W=()=>(0,_.useContext)(U),G=({children:e})=>{let[t,n]=(0,_.useState)(null),[r,i]=(0,_.useState)(!0);return(0,_.useEffect)(()=>l(V,e=>{n(e),i(!1)}),[]),(0,H.jsx)(U.Provider,{value:{user:t,loading:r},children:e})},K=()=>{let[e,t]=(0,_.useState)(``),[n,r]=(0,_.useState)(``),[i,a]=(0,_.useState)(!1),[o,s]=(0,_.useState)(null);return(0,H.jsxs)(`div`,{className:`login-overlay`,children:[(0,H.jsxs)(`div`,{className:`login-card`,children:[(0,H.jsxs)(`div`,{className:`login-header`,children:[(0,H.jsx)(`h1`,{children:i?`Register your Soul`:`Prove your Worth`}),(0,H.jsx)(`p`,{children:`Enter the Sanctuary of Eternity`})]}),(0,H.jsxs)(`form`,{onSubmit:async t=>{t.preventDefault(),s(null);try{i?await m(V,e,n):await p(V,e,n)}catch(e){s(e.message)}},className:`login-form`,children:[(0,H.jsx)(`input`,{type:`email`,placeholder:`Email Address`,value:e,onChange:e=>t(e.target.value),required:!0}),(0,H.jsx)(`input`,{type:`password`,placeholder:`Secret Key`,value:n,onChange:e=>r(e.target.value),required:!0}),(0,H.jsx)(`button`,{type:`submit`,className:`btn-primary`,children:i?`EMERGE`:`ASCEND`})]}),(0,H.jsx)(`div`,{className:`divider`,children:(0,H.jsx)(`span`,{children:`OR`})}),(0,H.jsx)(`button`,{onClick:async()=>{let e=new f;try{await h(V,e)}catch(e){s(e.message)}},className:`btn-github`,children:`SIGN IN WITH GITHUB`}),o&&(0,H.jsx)(`div`,{className:`login-error`,children:o}),(0,H.jsx)(`div`,{className:`login-footer`,children:(0,H.jsx)(`button`,{onClick:()=>a(!i),children:i?`Already have an account? Sign In`:`New here? Register your Soul`})})]}),(0,H.jsx)(`style`,{children:`
                .login-overlay {
                    position: fixed; inset: 0;
                    background: radial-gradient(circle at center, #1a1a1f 0%, #0a0a0c 100%);
                    z-index: 5000;
                    display: flex; align-items: center; justify-content: center;
                    padding: 20px;
                }
                .login-card {
                    width: 100%; max-width: 420px;
                    background: rgba(20, 20, 25, 0.95);
                    backdrop-filter: blur(20px);
                    border: 1px solid rgba(255, 105, 180, 0.15);
                    border-radius: 32px;
                    padding: 40px;
                    box-shadow: 0 40px 100px rgba(0,0,0,0.8);
                    text-align: center;
                }
                .login-header h1 { font-size: 28px; margin: 0; color: #ffc0cb; letter-spacing: -1px; }
                .login-header p { font-size: 14px; color: rgba(255,255,255,0.5); margin: 10px 0 30px; }
                .login-form { display: flex; flex-direction: column; gap: 15px; }
                .login-form input {
                    background: rgba(255,255,255,0.05);
                    border: 1px solid rgba(255,255,255,0.1);
                    border-radius: 12px;
                    padding: 14px; color: white; outline: none;
                    transition: border-color 0.3s;
                }
                .login-form input:focus { border-color: #ff69b4; }
                .divider { margin: 25px 0; border-bottom: 1px solid rgba(255,255,255,0.1); position: relative; }
                .divider span { position: absolute; top: -10px; left: 50%; transform: translateX(-50%); background: #141419; padding: 0 10px; font-size: 10px; color: rgba(255,255,255,0.3); }
                .btn-github {
                    width: 100%; background: #24292e; color: white; border: none; padding: 14px; border-radius: 12px; font-weight: 600; cursor: pointer;
                }
                .login-error { margin-top: 20px; color: #ff4757; font-size: 12px; }
                .login-footer { margin-top: 30px; }
                .login-footer button { background: none; border: none; color: rgba(255,255,255,0.4); cursor: pointer; font-size: 12px; text-decoration: underline; }
            `})]})},q=()=>{let e=(0,_.useRef)(null),{init:t,status:n,isLoaded:r,error:i,inferenceTime:a,fps:o,progress:s}=z(),{user:c,loading:l}=W();return l?(0,H.jsx)(`div`,{className:`loading-screen`,children:`Resonating with the Ley Lines...`}):c?(0,H.jsxs)(`div`,{className:`container`,children:[!r&&(0,H.jsxs)(`div`,{className:`overlay`,children:[(0,H.jsx)(`div`,{className:`spinner`}),(0,H.jsx)(`div`,{className:`progress-bar`,children:(0,H.jsx)(`div`,{className:`progress-fill`,style:{width:`${s}%`}})}),(0,H.jsx)(`h2`,{children:n}),i&&(0,H.jsx)(`p`,{className:`error`,children:i}),(0,H.jsx)(`button`,{className:`btn-primary`,onClick:()=>{e.current&&t(e.current)},children:`INITIATE ETERNITY`})]}),(0,H.jsxs)(`aside`,{className:`sidebar`,children:[(0,H.jsx)(`div`,{className:`logo`,children:`EasyVtuber V2 🌸`}),(0,H.jsxs)(`div`,{className:`user-profile`,children:[(0,H.jsx)(`img`,{src:c.photoURL||`https://api.dicebear.com/7.x/bottts/svg?seed=Miko`,alt:`Soul`}),(0,H.jsxs)(`div`,{className:`user-info`,children:[(0,H.jsx)(`span`,{className:`user-name`,children:c.displayName||`Elite User`}),(0,H.jsx)(`span`,{className:`user-email`,children:c.email})]}),(0,H.jsx)(`button`,{onClick:()=>V.signOut(),className:`btn-logout`,children:`🚪`})]}),(0,H.jsx)(`div`,{className:`status-badge`,children:`TS/WASM ELITE`}),(0,H.jsxs)(`div`,{className:`stats`,children:[(0,H.jsxs)(`div`,{className:`stat-item`,children:[(0,H.jsx)(`span`,{children:`Inference:`}),` `,a,`ms`]}),(0,H.jsxs)(`div`,{className:`stat-item`,children:[(0,H.jsx)(`span`,{children:`FPS:`}),` `,o]})]})]}),(0,H.jsx)(`main`,{className:`main-content`,children:(0,H.jsxs)(`div`,{className:`viewport`,children:[(0,H.jsx)(`video`,{ref:e,className:`input-video`}),(0,H.jsx)(`div`,{className:`render-area`,children:(0,H.jsx)(`div`,{className:`placeholder`,children:r?`Tracking Active...`:`System Offline`})})]})}),(0,H.jsx)(`style`,{children:`
                :root {
                    --primary: #ffc0cb;
                    --accent: #ff69b4;
                    --dark-bg: #0a0a0c;
                }
                body {
                    margin: 0;
                    background: var(--dark-bg);
                    color: white;
                    font-family: 'Inter', sans-serif;
                }
                .loading-screen { height: 100vh; display: flex; align-items: center; justify-content: center; background: #0a0a0c; color: #ffc0cb; font-weight: 800; letter-spacing: 2px; }
                .container { display: flex; height: 100vh; }
                .sidebar {
                    width: 340px;
                    background: rgba(20,20,25,0.9);
                    padding: 30px;
                    border-right: 1px solid rgba(255,255,255,0.1);
                    display: flex; flex-direction: column; gap: 30px;
                }
                .user-profile {
                    display: flex; align-items: center; gap: 15px; background: rgba(255,255,255,0.05); padding: 15px; border-radius: 20px; border: 1px solid rgba(255,255,255,0.05);
                }
                .user-profile img { width: 45px; height: 45px; border-radius: 12px; border: 2px solid var(--accent); }
                .user-info { display: flex; flex-direction: column; flex: 1; overflow: hidden; }
                .user-name { font-weight: 700; font-size: 14px; color: var(--primary); }
                .user-email { font-size: 10px; color: rgba(255,255,255,0.4); white-space: nowrap; text-overflow: ellipsis; overflow: hidden; }
                .btn-logout { background: none; border: none; font-size: 18px; cursor: pointer; opacity: 0.5; transition: opacity 0.3s; }
                .btn-logout:hover { opacity: 1; }
                
                .progress-bar { width: 300px; height: 4px; background: rgba(255,255,255,0.1); border-radius: 2px; margin-bottom: 20px; overflow: hidden; }
                .progress-fill { height: 100%; background: var(--accent); transition: width 0.3s cubic-bezier(0.4, 0, 0.2, 1); box-shadow: 0 0 10px var(--accent); }

                .main-content { flex: 1; display: flex; align-items: center; justify-content: center; }
                .viewport { display: flex; gap: 30px; }
                .input-video { width: 320px; border-radius: 24px; background: #000; box-shadow: 0 20px 50px rgba(0,0,0,0.5); }
                .render-area { width: 512px; height: 512px; border-radius: 32px; border: 1px solid rgba(255,105,180,0.2); background: rgba(0,0,0,0.3); display: flex; align-items: center; justify-content: center; box-shadow: 0 30px 80px rgba(0,0,0,0.6); }
                .overlay { position: fixed; inset: 0; background: var(--dark-bg); z-index: 100; display: flex; flex-direction: column; align-items: center; justify-content: center; }
                .btn-primary { background: linear-gradient(135deg, var(--accent), #ff1493); border: none; padding: 18px 50px; border-radius: 15px; color: white; font-weight: 800; cursor: pointer; margin-top: 30px; box-shadow: 0 10px 25px rgba(255,20,147,0.3); transition: transform 0.3s; }
                .btn-primary:hover { transform: translateY(-3px); }
            `})]}):(0,H.jsx)(K,{})};v.createRoot(document.getElementById(`root`)).render((0,H.jsx)(_.StrictMode,{children:(0,H.jsx)(()=>(0,H.jsx)(G,{children:(0,H.jsx)(q,{})}),{})}));