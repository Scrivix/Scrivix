const vm=require('vm'),fs=require('fs'),assert=require('assert');
const source=fs.readFileSync('matho/visible-clock.js','utf8');
let real=100000;
function screen(skew){let tick;const el={},c={Date:{now:()=>real+skew},performance:{now:()=>real},document:{querySelector:()=>el},setInterval:f=>tick=f};vm.createContext(c);vm.runInContext(source,c);return {clock:c.MathoVisibleClock,el,tick:()=>tick()};}
for(const skew of [-300000,450000]){
 real=100000;const teacher=screen(0),student=screen(skew),deadline=real+30000,echo=real+skew;
 real+=200;const packet={sentAt:real,deadline,running:true,remainingMs:deadline-real};
 real+=200;teacher.clock.update(packet);student.clock.update(packet,{remote:true,echo,hostTime:packet.sentAt});
 assert.equal(student.el.textContent,teacher.el.textContent,'Offset and round-trip latency corrected');
 for(const step of [1234,4111,2000]){real+=step;teacher.tick();student.tick();assert.equal(student.el.textContent,teacher.el.textContent);}
 // A later delayed state without an echoed ping must keep the same teacher deadline.
 real+=500;student.clock.update(packet,{remote:true,hostTime:packet.sentAt});teacher.tick();assert.equal(student.el.textContent,teacher.el.textContent);
 const paused={sentAt:real,deadline:null,running:false,remainingMs:17000};teacher.clock.update(paused);real+=300;student.clock.update(paused,{remote:true,hostTime:paused.sentAt});real+=8000;teacher.tick();student.tick();assert.equal(student.el.textContent,'Paused · 0:17');assert.equal(teacher.el.textContent,student.el.textContent);
 const resumed={sentAt:real,deadline:real+17000,running:true,remainingMs:17000};teacher.clock.update(resumed);real+=500;student.clock.update(resumed,{remote:true,hostTime:resumed.sentAt});teacher.tick();assert.equal(teacher.el.textContent,student.el.textContent);
 real+=4000;teacher.tick();student.tick();assert.equal(student.el.textContent,teacher.el.textContent,'Background delay catches up without one tick per second');
 student.clock.update(null,{remote:true,hostTime:real});assert(student.el.hidden);
}
console.log('PASS student/classroom agreement with clocks minutes ahead or behind, transport delay, stale updates, pause/resume, background delay, and hidden clock.');
