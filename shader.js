const gl = canvas.getContext("webgl2")
if (!gl) throw 'Unable to initialize WebGL. Your browser or machine may not support it.'
gl.disable(gl.DEPTH_TEST) // No 3d

function makeShader(type, source) {
	const shader = gl.createShader(type)
	gl.shaderSource(shader, source)
	gl.compileShader(shader)

	if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)){
		const info = gl.getShaderInfoLog(shader)
		gl.deleteShader(shader)
		throw 'GLSL Errors:\n' + info
	}
	return shader
}
const vertexShader = makeShader(gl.VERTEX_SHADER, `#version 300 es
void main(void) { gl_Position = vec4(float(1-((gl_VertexID&1)<<1)), float(1-(gl_VertexID&2)), 0., 1.); }`)
const program = gl.createProgram()
gl.attachShader(program, vertexShader)
let fragmentShader = null
function fractalShader(P){
	console.time('compile')
	if(fragmentShader) gl.detachShader(program, fragmentShader)
	fragmentShader = makeShader(gl.FRAGMENT_SHADER, `#version 300 es
precision mediump float;
precision highp int;
#define P ${P}
#define RI(r, i) uint r[P] = x, i[P] = y; \\
	uint _cx = uint(gl_FragCoord.x); \\
	uint _cy = uint(gl_FragCoord.y); \\
	uint _c2x = 0u, _c2y = 0u; \\
	uint _a = z & 31u, _zi = (z >> 5u); \\
	if(_a != 0u){ \\
		_c2x = _cx >> _a; _c2y = _cy >> _a; \\
		_cx <<= 32u - _a; _cy <<= 32u - _a; \\
		_zi++; \\
	} \\
	_a = r[_zi]; _cx = _c2x + uint((r[_zi] += _cx) < _a); \\
	_a = i[_zi]; _cy = _c2y + uint((i[_zi] += _cy) < _a); \\
	while(_zi-- > 0u && (_cx > 0u || _cy > 0u)){ \\
		_a = r[_zi]; _cx = uint((r[_zi] += _cx) < _a); \\
		_a = i[_zi]; _cy = uint((i[_zi] += _cy) < _a); \\
	}
#define mult(a, b, l, r) {\\
	uint o = (a & 0xFFFFu) * (b & 0xFFFFu);\\
  uint m1 = (a >> 16) * (b & 0xFFFFu);\\
  uint m2 = (a & 0xFFFFu) * (b >> 16);\\
  uint rd = o; l += (m1 >> 16) + (m2 >> 16);\\
  rd += (m1 << 16);\\
  l += uint(o > rd);\\
  o = rd;\\
  rd += (m2 << 16);\\
  l += uint(o > rd);\\
  l += (a >> 16) * (b >> 16);\\
	r += rd;\\
	if(r < rd)l++;\\
}
#define multiply(a, b) {\\
	uint carryl = 0u, carryr = 0u;\\
	if(P > 1){\\
		uint cr;\\
		mult(a[1], b[P - 1], carryr, cr);\\
		for(int _i = P - 2; _i > 0; _i--){\\
			uint cl = 0u;\\
			mult(a[P - _i], b[_i], cl, cr);\\
			uint _ = 0u; mult(a[P - _i], b[_i + 1], cr, _);\\
			carryr += cl;\\
			if(carryr < cl)carryl++;\\
		}\\
	}\\
	uint carry2l = 0u; uint carry2r = 0u;\\
	for(int _i = P - 1;_i > 0;_i--){\\
		uint cr = carryr;\\
		carryr = carryl; carryl = 0u;\\
		for(int j = _i - 1; j > 0; j--){\\
			uint cl = 0u;\\
			mult(a[j], b[_i - j], cl, cr);\\
			carryr += cl;\\
			if(carryr < cl)carryl++;\\
		}\\
		uint c2l = 0u, c2r = carry2r;\\
		carry2r = carry2l; carry2l = carry2r >= 2147483648u ? -1u : 0u;\\
		mult(b[0], a[_i], c2l, c2r);\\
		if(b[0] >= 2147483648u)c2l -= a[_i];\\
		carry2r += c2l;\\
		if(c2l >= 2147483648u)carry2l--;\\
		if(carry2r < c2l)carry2l++;\\
		c2l = 0u;\\
		mult(a[0], b[_i], c2l, c2r);\\
		if(a[0] >= 2147483648u)c2l -= b[_i];\\
		carry2r += c2l;\\
		if(c2l >= 2147483648u)carry2l--;\\
		if(carry2r < c2l)carry2l++;\\
		c2l = 0u;\\
		cr += c2r;\\
		if(cr < c2r){\\
			carryr++;\\
			if(carryr == 0u)carryl++;\\
		}\\
		a[_i] = cr;\\
	}\\
	a[0] = a[0] * b[0] + carryr + carry2r;\\
}
#define add(a, b) {\\
	bool _carry = false;\\
	for(int _i = P - 1;_i > 0;_i--){\\
		a[_i] += b[_i] + uint(_carry);\\
		_carry = _carry ? a[_i] <= b[_i] : a[_i] < b[_i];\\
	}\\
	a[0] += b[0] + uint(_carry);\\
}
#define dbl(a) {\\
	bool _carry = false;\\
	for(int _i = P - 1;_i >= 0;_i--){\\
		bool _carry2 = a[_i] >= 2147483648u;\\
		a[_i] = (a[_i] << 1) + uint(_carry);\\
		_carry = _carry2;\\
	}\\
}
#define take(a, b) {\\
	bool _carry = false;\\
	for(int _i = P - 1;_i > 0;_i--){\\
		a[_i] -= b[_i] + uint(_carry);\\
		_carry = _carry ? a[_i] >= ~b[_i] : a[_i] > ~b[_i];\\
	}\\
	a[0] -= b[0] + uint(_carry);\\
}
#define absolute(a) {\\
	if(a[0] >= 2147483648u){\\
		a[P - 1] = ~a[P - 1] + 1u;\\
		bool o = a[P - 1] == 0u;\\
		for(int _i = P - 2;_i >= 0;_i--){\\
			if(o){\\
				a[_i] = ~a[_i] + 1u;\\
				o = a[_i] == 0u;\\
			}else{a[_i] = ~a[_i];}\\
		}\\
	};\\
}
uniform Pos{
	uint x[P], y[P];
};
uniform uint z;
uniform uint steps;
uniform float gradient;
out vec4 fragColor;
float mandelbrot(){
	RI(r, i);
	uint tr[P] = r; uint ti[P] = i; uint t[P];
	for(uint j = 0u;j < steps; j++){
		float a = float(int(tr[0])) + float(tr[1]) / 4294967296.;
		float b = float(int(ti[0])) + float(ti[1]) / 4294967296.;
		a = a * a + b * b;
		if(a > 64.){ return float(j) - (log2(a)/6.); }
		/*Fast Complex Square Alg. (made by me, blob.kat@hotmail.com)*/
		for(int i = 0; i < P - 1; i++){
			t[i] = ti[i];
			ti[i] = (ti[i] << 1) | (ti[i + 1] >> 31);
		}
		t[P-1] = ti[P-1]; ti[P-1] <<= 1;
		multiply(ti, tr);
		//absolute(ti);
		take(tr, t);
		dbl(t);
		add(t, tr);
		multiply(tr, t);
		add(tr, r);
		add(ti, i);
	}
	return -999999.;
}
/*int mandelbrot_old(float r, float i){
	float tr = r; float ti = i; float t;
	for(int j = 0;j < 100; j++){
		if(ti * ti + tr * tr > 4.){ return float(j); }
		t = ti; ti += ti;
		ti *= tr;
		tr -= t;
		t += t;
		t += tr;
		tr *= t;
		tr += r;
		ti += i;
	}
	return -999999.;
}*/

vec3 Rainbow(float a){
	a = mod(sqrt(a * 5.), 6.);
	if(a < 2.){
		return a < 1. ? vec3(1.,a,0.) : vec3(2.-a,1.,0.);
	}else if(a < 4.){
		return a < 3. ? vec3(0.,1.,a-2.) : vec3(0.,4.-a,1.);
	}else{
		return a < 5. ? vec3(a-4.,0.,1.) : vec3(1.,0.,6.-a);
	}
}

vec3 Rainbow2(float a){
	a = mod(sqrt(a * 5.), 6.);
	if(a < 2.){
		return a < 1. ? vec3(1.,a,0.) : vec3(1.,0.,a-1.);
	}else if(a < 4.){
		return a < 3. ? vec3(a-2.,0.,1.) : vec3(0.,a-3.,1.);
	}else{
		return a < 5. ? vec3(0.,1.,a-4.) : vec3(a-5.,1.,0.);
	}
}

vec3 Grayscale(float a){
	a = mod(sqrt(a * 2.), 2.); if(a > 1.) a = 2. - a;
	return vec3(a);
}

vec3 Burning(float a){
	a = mod(sqrt(a * 3.), 3.);
	float b = 0.;
	if(a > 2.){
		b = 1. - abs(a * -2. + 5.);
		a = 0.;
 	}else if(a > 1.) a = 2. - a;
	return vec3(a+b,a+b*b,a);
}

void main() {
	float a = mandelbrot();
	fragColor.w = 1.;
	if(a == -999999.) discard;
	fragColor.xyz = ${mode.value}(a / gradient);
}`)
	gl.attachShader(program, fragmentShader)
	gl.linkProgram(program)
	if (!gl.getProgramParameter(program, gl.LINK_STATUS))
		throw new Error("Unable to initialize the shader program: " + gl.getProgramInfoLog(program))
	gl.useProgram(program)
	const ubo = gl.createBuffer()
  gl.bindBuffer(gl.UNIFORM_BUFFER, ubo)
  gl.bufferData(gl.UNIFORM_BUFFER, P*32, gl.DYNAMIC_DRAW)
	gl.bindBufferBase(gl.UNIFORM_BUFFER, 0, ubo)
	gl.uniformBlockBinding(program, gl.getUniformBlockIndex(program, 'Pos'), 0)
	const arr = new Uint32Array(P*8)
	console.timeEnd('compile')
	return function(x, y, z, steps = 100, gradient = 15){
		for(let i = 0; i < P; i++){
			arr[i<<2] = x[i]
			arr[i+P<<2] = y[i]
		}
		gl.bufferData(gl.UNIFORM_BUFFER, arr, gl.DYNAMIC_DRAW)
		gl.uniform1ui(gl.getUniformLocation(program, "z"), z)
		gl.uniform1ui(gl.getUniformLocation(program, "steps"), steps)
		gl.uniform1f(gl.getUniformLocation(program, "gradient"), gradient)
	}
}

for(const k of ['Rainbow', 'Rainbow2', 'Grayscale', 'Burning']){
	if(!mode.value) mode.value = k
	const o = document.createElement('option')
	o.value = o.textContent = k
	mode.append(o)
}

let l = 0
function mult(a, b){
	let o=(a&0xFFFF)*(b&0xFFFF);let m1=(a>>16)*(b&0xFFFF),m2=(a&0xFFFF)*(b>>16),rd=o;l=(m1>>16)+(m2>>16)|0;rd=rd+(m1<<16)|0;l=l+(o>rd)|0;o=rd;rd=rd+(m2<<16)|0;l=l+(o>rd)|0;l=l+(a>>16)*(b>>16)|0;r=r+rd|0;if(r<rd)l=l+1|0;return r
}
function multiply(a, b){
	let carryl = 0, carryr = 0
	if(P > 1){
		let cr = mult(a[1], b[P - 1]);carryr = l
		for(let i = P - 2; i > 0; i--){
			cr += mult(a[P - i], b[i + 1])
			cr += mult(a[P - i], b[i])
			carryr += l
			if(carryr < l)carryl++
		}
	}
	let carry2l = 0, carry2r = 0
	for(let i = P - 1;i > 0;i--){
		let cr = carryr
		carryr = carryl; carryl = 0
		for(let j = i - 1; j > 0; j--){
			cr = mult(a[j], b[i - j])
			carryr += l
			if(carryr < l)carryl++
		}
		let c2r = carry2r
		carry2r = carry2l; carry2l = carry2r >> 31
		c2r = mult(b[0], a[i])
		if(b[0] < 0)l -= a[i]
		carry2r += l
		if(l < 0)carry2l--
		if(carry2r < l)carry2l++
		c2r = mult(a[0], b[i])
		if(a[0] < 0)l -= b[i]
		carry2r += l
		if(l < 0)carry2l--
		if(carry2r < l)carry2l++
		cr += c2r
		if(cr < c2r){
			carryr++;
			if(carryr == 0)carryl++;
		}
		a[i] = cr;
	}
	a[0] = a[0] * b[0] + carryr + carry2r;
}
function add(a, b) {
	let carry = false
	for(let i = P - 1;i > 0;i--){
		a[i] += b[i] + carry
		carry = carry ? a[i] <= b[i] : a[i] < b[i]
	}
	a[0] += b[0] + carry
}
const shr = (num, pos) => {
	let t = cons(num / 2 ** (pos & 31), pos >>= 5)
	if(num<0)while(pos--) t[pos] = -1
	else while(pos--) t[pos] = 0
	return t
}

//z=8 means step in sizes of 1.0 >> 8 (1/256th) per pixel
let shader, x = new Uint32Array(), y = new Uint32Array(), z = 9, t = new Uint32Array()
let rx = 0, ry = 0, rz = 1
let P = 2
function setprecision(l = P){
	P = Math.max(2, l)
	shader = fractalShader(P)
	if(P > x.length){
		let newx = new Uint32Array(P), newy = new Uint32Array(P)
		newx.set(x, 0)
		newy.set(y, 0)
		x = newx; y = newy
		t = new Uint32Array(P)
	}else if(P < x.length){
		x = x.subarray(0, P)
		y = y.subarray(0, P)
		t = t.subarray(0, P)
	}
}
const c2 = document.createElement('canvas').getContext('2d', {willReadFrequently: true})
async function draw(){
	const pr = event ? new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))) : new Promise(requestAnimationFrame)
	//Clear buffer (optional)
	//gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT)
	const a = performance.now()
	info.style.setProperty('--c', 'red')
	if(z>P*32-36) setprecision(P+1)
	else if(z<(P-4)*32)setprecision(P-2)
	shader(x, y, z, z*2**slider.value, gradient.value)
	await pr
	gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4)
	c2.drawImage(canvas,0,0,1,1,0,0,1,1)
	c2.getImageData(0,0,1,1).data
	transform()
	justRendered = true
	const dt = performance.now() - a
	info.textContent = dt >= 10000 ? (dt/1000).toFixed(2)+'s' : (dt).toFixed(1) + 'ms'
	info.style.setProperty('--c', '#0a0')
}
function transform(){
	canvas.style.transform = `scaleY(-1) translateY(${innerHeight}px) scale(${rz}) translate(${-rx/pxrt}px, ${ry/pxrt}px)`
	stats.textContent = getStats()
}
let justRendered = false, zoomIn = false
function cons(v, i, c = t){
	if(P > i)c[i] = Math.floor(v)
	if(P > i + 1)c[i + 1] = Math.floor(v * 4294967296)
	if(P > i + 2)c[i + 2] = Math.floor(v * 18446744073709551616)
	if(P > i + 3)c[i + 3] = Math.floor(v * 79228162514264337593543950336)
	return c
}
function pos(a = false){
	let {top, left, bottom, right} = canvas.getBoundingClientRect()
	if(top > 0 || left > 0 || bottom < innerHeight || right < innerWidth || (zoomIn && rz >= 2) || a){
		if(rz > 2){
			//zoom in
			const padding = .5 - 1/rz
			add(x, shr(rx - WIDTH*padding/2, z))
			add(y, shr(ry - HEIGHT*padding/2, z))
			rz /= 2
			z++
			rx = WIDTH*padding; ry = HEIGHT*padding
		}else if(rz < 1.2 && !zoomIn){
			//zoom out
			const padding = 1 - .5/rz
			add(x, shr(rx - WIDTH*padding, z))
			add(y, shr(ry - HEIGHT*padding, z))
			rz *= 2
			z--
			rx = WIDTH*padding/2
			ry = HEIGHT*padding/2
		}else{
			//pan
			const padding = .5 - .5/rz
			add(x, shr(rx - WIDTH*padding, z))
			add(y, shr(ry - HEIGHT*padding, z))
			rx = WIDTH*padding; ry = HEIGHT*padding
		}
		/*if(!zoomIn){
			add(x, shr(-rx - WIDTH >> 2, z))
			add(y, shr(-ry - HEIGHT >> 2, z))
			if(rz <= 1.2){
				z--
				rz *= 2
			}
			rx = -(WIDTH >> 3) * rz
			ry = -(HEIGHT >> 3) * rz
			
		}else{
			add(x, shr(-rx, z))
			add(y, shr(-ry, z))
			z++
			rx = 0
			ry = 0
			rz /= 2
		}*/
		zoomIn = false
		draw()
	}else transform()
}
let click = false, mx = 0, my = 0
let pxrt = devicePixelRatio
onresize = function(a){
	WIDTH = Math.round(visualViewport.width*visualViewport.scale * pxrt)
	HEIGHT = Math.round(visualViewport.height*visualViewport.scale * pxrt)
	canvas.width = WIDTH
	canvas.height = HEIGHT
	mx = WIDTH / 2
	my = HEIGHT / 2
	gl.viewport(0, 0, gl.canvas.width, gl.canvas.height)
	if(!a){
		cons(WIDTH * (-.5 / 2**z) - .6, 0, x)
		cons(HEIGHT * (-.5 / 2**z), 0, y)
	}
	draw()
}
setprecision(P)
onresize(false)

function wheel(deltaY){
	if(justRendered)return void(justRendered = false)
	let d = 0.99 ** deltaY
	d = Math.max(d, 2 ** (7+Math.log2(pxrt) - z) / rz)
	if(d>1)zoomIn=true
	rz *= d
	rx += mx * (d - 1) / rz
	ry += my * (d - 1) / rz
	pos()
}
onmousedown = ({target}) => void(click = target == canvas)
onmouseup = () => click = false
onmousemove = function({clientX, clientY}){
	if(click){
		rx -= (clientX * pxrt - mx) / rz
		ry -= (clientY * pxrt - my) / rz
		pos()
	}
	mx = clientX * pxrt
	my = clientY * pxrt
}
function arrToNum(x){
	let n = 10000000000n ** BigInt(P - 1)
	let xr = BigInt(x[0]|0)*n
	n /= 4294967296n // Round towards zero, `>> 32` would round down
	for(let i = 1; i < P; i++){
		xr += BigInt(x[i]) * n
		n /= 4294967296n
	}
	const total = (P - 1) * 10, wasted = total - Math.floor(z / Math.log2(10) + 1)
	const xf = (xr+'').replace('-', '').padStart(total+1, '0')
	return (xr < 0 ? '-' : '') + xf.slice(0, -total) + '.' + xf.slice(-total, wasted?-wasted:undefined)
}
function getStats(){
	let a = shr(rx+WIDTH/2/rz, z)
	add(a, x)
	const xStr = arrToNum(a)
	a = shr(ry+HEIGHT/2/rz, z)
	add(a, y)
	const yStr = arrToNum(a)
	const exp = (z - 9) / Math.log2(10) + Math.log10(rz)
	return `r: ${xStr}\ni: ${yStr}\nzoom: ${(10**((exp%1+1)%1)).toFixed(2)}x10^${Math.floor(exp)}\nprecision: ${P*32} bits`
}
stats.onclick = () => navigator.clipboard.writeText(getStats())

addEventListener('wheel',e=>void(e.preventDefault(),wheel(e.deltaY)),{passive:false})

const keypresses = {
	Tab(){
		canvas.style.zIndex = 1-canvas.style.zIndex
	}
}
let isAuto = false
auto.onclick = () => {
	if(isAuto) return isAuto = false, auto.style.border='', void 0
	isAuto = true
	auto.style.border = '#fff 2px solid'
	let last = performance.now()/1000
	requestAnimationFrame(function A(){
		if(!isAuto) return
		requestAnimationFrame(A)
		wheel(last-(last=performance.now()/30))
	})
}

save.onclick = async () => {
	rx -= WIDTH/4 * (rz-1)
	ry -= WIDTH/4 * (rz-1)
	add(x, shr(rx, z))
	add(y, shr(ry, z))
	rz = 1
	rx = ry = 0
	await draw()
	const c = document.createElement('canvas').getContext('2d')
	c.canvas.width = WIDTH; c.canvas.height = HEIGHT
	c.scale(1,-1)
	c.drawImage(canvas, 0, 0, WIDTH, -HEIGHT)
	c.canvas.toBlob(blob => {
		const a = document.createElement('a')
		a.href = URL.createObjectURL(blob)
		a.download = 'fractal'
		a.click()
	})
}
fs.onclick = () => document.body.requestFullscreen()

onkeyup = e => {const p = keypresses[e.key];p&&(e.preventDefault(),p(e))}
onkeydown = e => {keypresses[e.key]&&e.preventDefault()}