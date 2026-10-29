(function(root){
'use strict';
const f=['','אחת','שתיים','שלוש','ארבע','חמש','שש','שבע','שמונה','תשע','עשר'];
const m=['','אחד','שניים','שלושה','ארבעה','חמישה','שישה','שבעה','שמונה','תשעה','עשרה'];
const fv=['','אַחַת','שְׁתַּיִם','שָׁלוֹשׁ','אַרְבַּע','חָמֵשׁ','שֵׁשׁ','שֶׁבַע','שְׁמוֹנֶה','תֵּשַׁע','עֶשֶׂר'];
const mv=['','אֶחָד','שְׁנַיִם','שְׁלוֹשָׁה','אַרְבָּעָה','חֲמִשָּׁה','שִׁשָּׁה','שִׁבְעָה','שְׁמוֹנָה','תִּשְׁעָה','עֲשָׂרָה'];
const ft=['','אַחַת','שְׁתֵּים','שְׁלוֹשׁ','אַרְבַּע','חֲמֵשׁ','שֵׁשׁ','שְׁבַע','שְׁמוֹנֶה','תְּשַׁע'];
const mt=['','אַחַד','שְׁנֵים',...mv.slice(3,10)];
const tens=['','','עשרים','שלושים','ארבעים','חמישים','שישים','שבעים','שמונים','תשעים'];
const tv=['','','עֶשְׂרִים','שְׁלוֹשִׁים','אַרְבָּעִים','חֲמִשִּׁים','שִׁשִּׁים','שִׁבְעִים','שְׁמוֹנִים','תִּשְׁעִים'];
const hv=['','מֵאָה','מָאתַיִם','שְׁלוֹשׁ מֵאוֹת','אַרְבַּע מֵאוֹת','חֲמֵשׁ מֵאוֹת','שֵׁשׁ מֵאוֹת','שְׁבַע מֵאוֹת','שְׁמוֹנֶה מֵאוֹת','תְּשַׁע מֵאוֹת'];
function and(s,v){if(!v)return 'ו'+s;return (/^שְׁ/.test(s)?'וּ':'וְ')+s;}
function words(n,gender='f',vocalized=false){
 if(!Number.isInteger(n)||n<1||n>999||!['f','m'].includes(gender))throw new Error('Invalid number or gender');
 const a=gender==='f'?(vocalized?fv:f):(vocalized?mv:m);
 if(n<=10)return a[n];
 if(n<20){const k=n-10;const first=vocalized?(gender==='f'?ft:mt)[k]:(k===2?(gender==='f'?'שתים':'שנים'):a[k]);return first+' '+(gender==='f'?(vocalized?'עֶשְׂרֵה':'עשרה'):(vocalized?'עָשָׂר':'עשר'));}
 if(n<100){const t=(vocalized?tv:tens)[Math.floor(n/10)];return t+(n%10?' '+and(a[n%10],vocalized):'');}
 const h=Math.floor(n/100),r=n%100;
 const head=vocalized?hv[h]:h===1?'מאה':h===2?'מאתיים':f[h]+' מאות';
 if(!r)return head;
 const tail=words(r,gender,vocalized);
 return head+' '+((r<20||r%10===0)?and(tail,vocalized):tail);
}
function normalize(s){return String(s).normalize('NFKC').replace(/[\u0591-\u05BD\u05BF-\u05C7]/g,'').replace(/[\u200e\u200f\u202a-\u202e\u2066-\u2069]/g,'').replace(/[-־–—]/g,' ').trim().replace(/\s+/g,' ').split(' ').map(token=>{const prefix=token.startsWith('ו')?'ו':'';let w=prefix?token.slice(1):token;w=({'שתים':'שתיים','שנים':'שניים','שלש':'שלוש','שלשה':'שלושה','חמשה':'חמישה','ששה':'שישה','שמנה':'שמונה','מאתים':'מאתיים','שלשים':'שלושים','חמשים':'חמישים','ששים':'שישים','שמנים':'שמונים'})[w]||w;return prefix+w;}).join(' ');}
function accepts(n,g,input){const value=normalize(input);const forms=[words(n,g),words(n,g,true)];const r=n%100;if(n>100&&r>=20&&r%10!==0){const h=words(n-r,g);forms.push(h+' ו'+words(r,g));}return forms.some(x=>normalize(x)===value);}
const api={words,normalize,accepts};if(typeof module!=='undefined')module.exports=api;else root.HebrewNumbers=api;
})(globalThis);
