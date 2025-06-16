const gl = canvas.getContext('webgl2', {depth: false, alpha: false})
if (!gl) throw "WebGLn't"
gl.disable(gl.DEPTH_TEST) // No 3d
gl.disable(gl.CULL_FACE)

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

const USE_BLOCK = true

function fractalShader(P){
	console.time('compile')
	if(fragmentShader) gl.detachShader(program, fragmentShader)
	fragmentShader = makeShader(gl.FRAGMENT_SHADER, `#version 300 es
#line 29
precision highp float;
precision highp int;
#define P ${P}
#define big uint[P]
#define CHECK(tr, ti, L) {\\
	float _a = float(int(tr[0])) + float(tr[1]) / 4294967296.; \\
	float _b = float(int(ti[0])) + float(ti[1]) / 4294967296.; \\
	_a = _a * _a + _b * _b; \\
	${smooth.checked?'if(_a > 16.*L*L){ return float(j) - (log2(_a)/(4.+2.*log2(L))); }':'if(_a > L*L){ return float(j); }'}}
#define mult(a, b, l, r) {\\
	uint _r = a * b; \\
	uint _x = (a&0xFFFFu)*(b>>16), _y = (a>>16)*(b&0xFFFFu); \\
	l += (a>>16)*(b>>16)+(_x>>16)+(_y>>16)-uint(int((_r>>16)-(_x&0xFFFFu)-(_y&0xFFFFu))>>16); \\
	r += _r; \\
	l += uint(r < _r); \\
}
#define multiply(a, b) {\\
	uint carryl = 0u, carryr = 0u;\\
	uint _;\\
	mult(a[1], b[P - 1], carryr, _);\\
	for(int _i = P - 2; _i > 0; _i--){\\
		uint cl = 0u;\\
		mult(a[P - _i], b[_i], cl, _);\\
		carryr += cl;\\
		carryl += uint(carryr < cl);\\
	}\\
	uint carry2l = 0u, carry2r = 0u;\\
	for(int _i = P - 1;_i > 0;_i--){\\
		uint cr = carryr;\\
		carryr = carryl; carryl = 0u;\\
		for(int _j = _i - 1; _j > 0; _j--){\\
			uint cl = 0u;\\
			mult(a[_j], b[_i - _j], cl, cr);\\
			carryr += cl;\\
			carryl += uint(carryr < cl);\\
		}\\
		uint c2l = 0u, c2r = carry2r;\\
		carry2r = carry2l; carry2l = uint(int(carry2r) >> 31);\\
		mult(b[0], a[_i], c2l, c2r);\\
		c2l -= a[_i]&-uint(b[0] >= 2147483648u);\\
		carry2r += c2l;\\
		carry2l += uint(carry2r < c2l) - uint(c2l >= 2147483648u);\\
		c2l = 0u;\\
		mult(a[0], b[_i], c2l, c2r);\\
		c2l -= b[_i]&-uint(a[0] >= 2147483648u);\\
		carry2r += c2l;\\
		carry2l += uint(carry2r < c2l) - uint(c2l >= 2147483648u);\\
		c2l = 0u;\\
		cr += c2r;\\
		_ = uint(cr < c2r); carryr += _;\\
		carryl += uint(carryr==0u)&_;\\
		a[_i] = cr;\\
	}\\
	a[0] = a[0] * b[0] + carryr + carry2r;\\
}

#define multiplyc(a, b) {\\
	uint carryl = 0u, carryr = 0u;\\
	uint b0 = uint(int(floor(b))), b1 = uint(mod(b,1.) * 4294967296.); \\
	uint _; \\
	mult(a[P-1], b1, carryr, _);\\
	uint carry2l = 0u; uint carry2r = 0u;\\
	for(int _i = P - 1;_i > 0;_i--){\\
		uint cr = carryr;\\
		carryr = carryl;\\
		{ \\
			uint cl = 0u;\\
			mult(a[_i-1], b1, cl, cr);\\
			carryr += cl;\\
			carryl = uint(carryr < cl);\\
			cl = 0u;\\
			mult(a[_i], b0, cl, cr);\\
			carryr += cl;\\
			carryl += uint(carryr < cl);\\
		} \\
		uint c2l = 0u, c2r = carry2r;\\
		carry2r = carry2l; carry2l = carry2r >= 2147483648u ? -1u : 0u;\\
		mult(b0, a[_i], c2l, c2r);\\
		if(b0 >= 2147483648u)c2l -= a[_i];\\
		carry2r += c2l;\\
		carry2l -= uint(c2l >= 2147483648u);\\
		carry2l += uint(carry2r < c2l);\\
		if(_i == 0){ \\
			c2l = 0u;\\
			mult(a[0], b0, c2l, c2r);\\
			if(a[0] >= 2147483648u)c2l -= b0;\\
			carry2r += c2l;\\
			carry2l += uint(carry2r < c2l) - uint(c2l >= 2147483648u);\\
		}else if(_i == 1){ \\
			c2l = 0u;\\
			mult(a[0], b1, c2l, c2r);\\
			if(a[0] >= 2147483648u)c2l -= b1;\\
			carry2r += c2l;\\
			carry2l += uint(carry2r < c2l) - uint(c2l >= 2147483648u);\\
		} \\
		c2l = 0u;\\
		cr += c2r;\\
		if(cr < c2r){\\
			carryr++;\\
			carryl += (carryr == 0u);\\
		}\\
		a[_i] = cr;\\
	}\\
	a[0] = a[0] * b0 + carryr + carry2r;\\
}

#define add(a, b) {\\
	uint _carry = 0u;\\
	for(int _i = P - 1;_i > 0;_i--){\\
		a[_i] += b[_i] - _carry;\\
		_carry ^= -uint((_carry^a[_i]) < (_carry^b[_i]));\\
	}\\
	a[0] += b[0] - _carry;\\
}
#define addw(a, b, w) {\\
	uint _carry = 0u;\\
	uint _h, _l; \\
	mult(b[P-1], w, _h, _l); \\
	for(int _i = P - 1;_i > 1;_i--){\\
		a[_i] += _h; \\
		_carry ^= -uint((_carry^a[_i] < _carry^_h));\\
		mult(b[_i-1], w, _h, _l); \\
		a[_i] += _l - _carry;\\
		_carry ^= -uint((_carry^a[_i]) < (_carry^_l));\\
	}\\
	a[1] += _h; \\
	_carry ^= -uint((_carry^a[1]) < (_carry^_h));\\
	mult(b[0], w, _h, _l); \\
	_h = uint(int(_h << 16) >> 16); \\
	a[1] += _l - _carry;\\
	_carry ^= -uint((_carry^a[1]) < (_carry^_l));\\
	a[0] += _h - _carry;\\
}
#define addc(a, b) {\\
	uint _c = uint(mod(b,1.) * 4294967296.); \\
	a[1] += _c; \\
	a[0] += uint(int(floor(b))) + uint((a[1] < _c)); \\
}
#define double(a) {\\
	for(int _i = 0; _i < P - 1; _i++) \\
		a[_i] = (a[_i] << 1) | (a[_i + 1] >> 31); \\
	a[P-1] <<= 1; \\
}
#define take(a, b) {\\
	uint _c = 0u;\\
	for(int _i = P - 1;_i > 0;_i--){\\
		a[_i] -= b[_i] - _c;\\
		_c ^= -uint((_c^a[_i]) > (_c^~b[_i]));\\
	}\\
	a[0] -= b[0] - _c;\\
}
#define neg(a) {\\
	uint _o = 1u; \\
	for(int i = P - 1;i >= 0;i--) _o &= uint((a[i] = ~a[i] + _o)==0u);\\
}
#define absolute(a) if(a[0] >= 2147483648u) neg(a)
#define set(a, b) {\\
	a[0] = uint(int(floor(b))); \\
	a[1] = uint(mod(b,1.) * 4294967296.); \\
}

${USE_BLOCK?`uniform Pos{ big x, y; };`:`uniform big x, y;`}
uniform vec2 p;
uniform uint z;
uniform uint steps;
uniform float gradient;
out vec4 fragColor;
big r, i;

float Mandelbrot(){
	big tr = r, ti = i, t;
	addc(tr, p.x); addc(ti, p.y);
	for(uint j = 0u;j < steps; j++){
		CHECK(tr, ti, 2.);
		/*Fast Complex Square Alg. (made by me, blob.kat@hotmail.com)*/
		t = ti;
		double(ti);
		multiply(ti, tr);
		take(tr, t);
		double(t);
		add(t, tr);
		multiply(tr, t);
		add(tr, r);
		add(ti, i);
	}
	return intBitsToFloat(-1);
}
float Julia(){
	big t;
	for(uint j = 0u;j < steps; j++){
		CHECK(r, i, 2.);
		/*Fast Complex Square Alg. (made by me, blob.kat@hotmail.com)*/
		t = i;
		double(i);
		multiply(i, r);
		take(r, t);
		double(t);
		add(t, r);
		multiply(r, t);
		addc(r, p.x);
		addc(i, p.y);
	}
	return intBitsToFloat(-1);
}

float BurningShip(){
	big tr, ti, t;
	set(tr, p.x); set(ti, p.y);
	for(uint j = 0u;j < steps; j++){
		CHECK(tr, ti, 2.);
		/*Fast Complex Square Alg. (made by me, blob.kat@hotmail.com)*/
		t = ti;
		double(ti);
		multiply(ti, tr);
		absolute(ti);
		take(tr, t);
		double(t);
		add(t, tr);
		multiply(tr, t);
		add(tr, r);
		add(ti, i);
	}
	return intBitsToFloat(-1);
}

float BurningJulia(){
	big tr = r, ti = i, t;
	for(uint j = 0u;j < steps; j++){
		CHECK(tr, ti, 2.);
		/*Fast Complex Square Alg. (made by me, blob.kat@hotmail.com)*/
		t = ti;
		double(ti);
		multiply(ti, tr);
		absolute(ti);
		take(tr, t);
		double(t);
		add(t, tr);
		multiply(tr, t);
		addc(tr, p.x);
		addc(ti, p.y);
	}
	return intBitsToFloat(-1);
}

vec3 Rainbow(float a){
	a = mod(a, 6.);
	if(a < 2.){
		return a < 1. ? vec3(1.,a,0.) : vec3(2.-a,1.,0.);
	}else if(a < 4.){
		return a < 3. ? vec3(0.,1.,a-2.) : vec3(0.,4.-a,1.);
	}else{
		return a < 5. ? vec3(a-4.,0.,1.) : vec3(1.,0.,6.-a);
	}
}

vec3 Ocean(float a){
	a = mod(a, 4.);
	if(a < 2.){
		return a < 1. ? vec3(0.,0.,a/2.) : vec3(0.,a/2.-.5,a/2.);
	}else{
		return a < 3. ? vec3(a/2.-1.,1.5-a/2.,1.) : vec3(2.-a/2.,0.,4.-a);
	}
}

vec3 Grayscale(float a){
	a = mod(a, 2.); if(a > 1.) a = 2. - a;
	return vec3(a);
}

vec3 Burning(float a){
	a = mod(a, 3.);
	float b = 0.;
	if(a > 2.){
		b = 1. - abs(a * -2. + 5.);
		a = 0.;
 	}else if(a > 1.) a = 2. - a;
	return vec3(a+b,a+b*b,a);
}

vec3 FiveColor(float a){
	a = mod(a, 12.);
	if(a >= 6.){
		if(a >= 10.){
			return a >= 11. ? vec3(1.,12.-a,12.-a) : vec3(1.,a-10.,1.);
		}else if(a >= 8.){
			return a >= 9. ? vec3(a-9.,0.,a-9.) : vec3(0.,0.,9.-a);
		}else{
			return a >= 7. ? vec3(8.-a,8.-a,1.) : vec3(a-6.,1.,1.);
		}
	}else{
		if(a >= 4.){
			return a >= 5. ? vec3(0.,a-5.,a-5.) : vec3(0.,5.-a,0.);
		}else if(a >= 2.){
			return a >= 3. ? vec3(4.-a,1.,4.-a) : vec3(1.,1.,a-2.);
		}else{
			return a >= 1. ? vec3(a-1.,a-1.,0.) : vec3(1.-a,0.,0.);
		}
	}
}

void main(){
	r = x; i = y;
	uint _cx = uint(gl_FragCoord.x);
	uint _cy = uint(gl_FragCoord.y);
	uint _c2x = 0u, _c2y = 0u;
	uint _a = z & 31u, _zi = (z >> 5u);
	if(_a != 0u){
		_c2x = _cx >> _a; _c2y = _cy >> _a;
		_cx <<= 32u - _a; _cy <<= 32u - _a;
		_zi++;
	}
	if(_zi >= uint(P)){
		_cx = _c2x; _cy = _c2y;
		if(_zi > uint(P)) _zi = uint(P);
	}else{
		_a = r[_zi]; _cx = _c2x + uint((r[_zi] += _cx) < _a);
		_a = i[_zi]; _cy = _c2y + uint((i[_zi] += _cy) < _a);
	}
	while(_zi-- > 0u && (_cx > 0u || _cy > 0u)){
		_a = r[_zi]; _cx = uint((r[_zi] += _cx) < _a);
		_a = i[_zi]; _cy = uint((i[_zi] += _cy) < _a);
	}
	float a = ${fractal.value}();
	fragColor = vec4(0);
	if(!isnan(a)) fragColor.xyz = ${mode.value}(log2(max(1., a+1.)) * gradient);
}`)
	gl.attachShader(program, fragmentShader)
	gl.linkProgram(program)
	if (!gl.getProgramParameter(program, gl.LINK_STATUS))
		throw new Error("Unable to initialize the shader program: " + gl.getProgramInfoLog(program))
	gl.useProgram(program)
	let arr
	if(USE_BLOCK){
		const ubo = gl.createBuffer()
		gl.bindBuffer(gl.UNIFORM_BUFFER, ubo)
		gl.bufferData(gl.UNIFORM_BUFFER, P*32, gl.DYNAMIC_DRAW)
		gl.bindBufferBase(gl.UNIFORM_BUFFER, 0, ubo)
		gl.uniformBlockBinding(program, gl.getUniformBlockIndex(program, 'Pos'), 0)
		arr = new Uint32Array(P*8)
	}
	console.timeEnd('compile')
	let uniX, uniY
	if(!USE_BLOCK){
		uniX = gl.getUniformLocation(program, "x")
		uniY = gl.getUniformLocation(program, "y")
	}
	const uniP = gl.getUniformLocation(program, "p")
	const uniZ = gl.getUniformLocation(program, "z")
	const uniSteps = gl.getUniformLocation(program, "steps")
	const uniGradient = gl.getUniformLocation(program, "gradient")
	return (x, y, z, steps = 100, gradient = 15) => {
		if(USE_BLOCK){
			for(let i = 0; i < P; i++){
				arr[i<<2] = x[i]
				arr[i+P<<2] = y[i]
			}
			gl.bufferData(gl.UNIFORM_BUFFER, arr, gl.DYNAMIC_DRAW)
		}else{
			gl.uniform1uiv(uniX, x)
			gl.uniform1uiv(uniY, y)
		}
		gl.uniform2f(uniP, +r.value, +i.value)
		gl.uniform1ui(uniZ, z)
		gl.uniform1ui(uniSteps, steps)
		gl.uniform1f(uniGradient, 0.5 ** gradient)
	}
}

for(const k of ['Rainbow', 'FiveColor', 'Ocean', 'Grayscale', 'Burning']){
	if(!mode.value) mode.value = k
	const o = document.createElement('option')
	o.value = o.textContent = k
	mode.append(o)
}
for(const k of ['Mandelbrot', 'BurningShip', 'Julia', 'BurningJulia']){
	if(!fractal.value) fractal.value = k
	const o = document.createElement('option')
	o.value = o.textContent = k
	fractal.append(o)
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
	let t = set(num / 2 ** (pos & 31), pos >>= 5)
	if(num<0)while(pos--) t[pos] = -1
	else while(pos--) t[pos] = 0
	return t
}

//z=8 means step in sizes of 1.0 >> 8 (1/256th) per pixel
let shader, x = new Uint32Array(), y = new Uint32Array(), z = 9, t = new Uint32Array()
let rx = 0, ry = 0, rz = 1
let P = 2
function setprecision(P2 = P){
	shader = fractalShader(P = Math.max(2, P2))
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
	//Clear buffer (optional)
	//gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT)
	const a = performance.now()
	if(z>P*32-36 && !lock) setprecision(P+1)
	else if(z<(P-4)*32 && !lock) setprecision(P-2)
	shader(x, y, z, z*2**slider.value, gradient.value)
	transform()
	gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4)
	c2.drawImage(canvas,0,0,1,1,0,0,1,1)
	c2.getImageData(0,0,1,1).data[0]
	rendering = true
	const dt = performance.now() - a
	info.textContent = dt >= 2000 ? (dt/1000).toFixed(2)+'s' : (dt).toFixed(1) + 'ms'
	requestAnimationFrame(() => rendering = false)
}
function transform(){
	canvas.style.transform = `scaleY(-1) translateY(${innerHeight}px) scale(${rz}) translate(${-rx/pxrt}px, ${ry/pxrt}px)`
	stats.textContent = getStats()
}
let rendering = false, zoomIn = false
function set(v, i, c = t){
	if(P > i)c[i] = Math.floor(v)
	if(P > i + 1)c[i + 1] = Math.floor(v * 4294967296)
	if(P > i + 2)c[i + 2] = Math.floor(v * 18446744073709551616)
	if(P > i + 3)c[i + 3] = Math.floor(v * 79228162514264337593543950336)
	return c
}
function pos(a = false){
	transform()
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
	}
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
		set(WIDTH * (-.5 / 2**z) - .6, 0, x)
		set(HEIGHT * (-.5 / 2**z), 0, y)
	}
	draw()
}
setprecision(P)

function wheel(deltaY){
	if(rendering) return
	let d = Math.max(0.5, Math.min(2, 0.99 ** deltaY))
	d = Math.max(d, 2 ** (4+Math.log2(pxrt) - z) / rz)
	if(d>1) zoomIn = true
	rz *= d
	rx += mx * (d - 1) / rz
	ry += my * (d - 1) / rz
	pos()
}
onmousedown = ({target}) => void(click = target == canvas)
onmouseup = () => void(click = false)
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
	let n = 10000000000n ** BigInt(P)
	let xr = BigInt(x[0]|0)*n
	n /= 4294967296n // Round towards zero, `>> 32` would round down
	for(let i = 1; i < P; i++){
		xr += BigInt(x[i]) * n
		n /= 4294967296n
	}
	xr = xr/10000000000n+1n
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
	return `r: ${xStr}\ni: ${yStr}\nzoom: ${(10**((exp%1+1)%1)).toFixed(2)}x10^${Math.floor(exp)}\nprecision: ${P*32} bits\niter: ${z*2**slider.value}`
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
	const pr = event ? new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))) : new Promise(requestAnimationFrame)
	//Clear buffer (optional)
	//gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT)
	const a = performance.now()
	rx -= WIDTH/4 * (rz-1)
	ry -= WIDTH/4 * (rz-1)
	add(x, shr(rx, z))
	add(y, shr(ry, z))
	rz = 1
	rx = ry = 0
	canvas.width = WIDTH <<= Math.max(0, -supersample.value)
	canvas.height = HEIGHT <<= Math.max(0, -supersample.value)
	shader(x, y, z-supersample.value, z*2**slider.value, gradient.value**2)
	gl.viewport(0, 0, canvas.width, canvas.height)
	await pr
	gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4)
	rendering = true
	const dt = performance.now() - a
	const c = document.createElement('canvas').getContext('2d')
	c.canvas.width = WIDTH; c.canvas.height = HEIGHT
	c.scale(1,-1)
	c.fillStyle = getComputedStyle(canvas).backgroundColor
	c.fillRect(0,0,WIDTH,-HEIGHT)
	c.drawImage(canvas, 0, 0, WIDTH, -HEIGHT)
	canvas.width = WIDTH >>>= Math.max(0, -supersample.value)
	canvas.height = HEIGHT >>>= Math.max(0, -supersample.value)
	info.textContent = dt >= 10000 ? (dt/1000).toFixed(2)+'s' : (dt).toFixed(1) + 'ms'
	c.canvas.toBlob(blob => {
		const a = document.createElement('a')
		a.href = URL.createObjectURL(blob)
		a.download = 'fractal'
		a.click()
		draw()
	})
}
fs.onclick = () => document.body.requestFullscreen()
let lock = false
lp.onclick = () => {
	lp.style.border = (lock = !lock) ? '2px white solid' : ''
}
ip.onclick = () => {
	lp.style.border = '2px white solid'
	lock = true
	setprecision(P+1)
	draw()
}

onkeyup = e => {const p = keypresses[e.key];p&&(e.preventDefault(),p(e))}
onkeydown = e => {keypresses[e.key]&&e.preventDefault()}


onresize(null)