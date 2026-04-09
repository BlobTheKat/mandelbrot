/** @type {WebGL2RenderingContext} */
const gl = canvas.getContext('webgl2', {depth: false, alpha: false, preserveDrawingBuffer: false})
if (!gl) throw "WebGLn't"
gl.disable(gl.DEPTH_TEST) // No 3d
gl.disable(gl.CULL_FACE)

const fb = gl.createFramebuffer(), tex = gl.createTexture()
gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, fb)
gl.bindTexture(gl.TEXTURE_2D, tex)
gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
gl.framebufferTexture2D(gl.DRAW_FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0)
gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, null)
const floatExt = !!(gl.getExtension('EXT_color_buffer_float') && gl.getExtension('OES_texture_float_linear'))

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
out vec2 uv; void main(){ uv = vec2(gl_VertexID&1, gl_VertexID>>1); gl_Position = vec4(uv*2.-1.,0,1); }`)
const p1 = gl.createProgram()
gl.attachShader(p1, vertexShader)
let fragmentShader = null

const USE_BLOCK = true

function fractalShader(P){
	console.time('compile')
	if(fragmentShader) gl.detachShader(p1, fragmentShader)
	fragmentShader = makeShader(gl.FRAGMENT_SHADER, `#version 300 es
#line 30
precision highp float;
precision highp int;
#define P ${P}
#define big uint[P]
#define Check(j, tr, ti, L, R) {\\
	float _a = float(int(tr[0])) + float(tr[1]) / 4294967296.; \\
	float _b = float(int(ti[0])) + float(ti[1]) / 4294967296.; \\
	_a = _a * _a + _b * _b; \\
	${smooth.checked?'if(_a > pow(4.,R)*L*L){ return float(j) + 1.-log2(log(_a)*.5)/log2(R); }':'if(_a > L*L){ return float(j); }'}}
#define mult(a, b, l, r) {\\
	uint _r = a * b; \\
	uint _x = (a&0xFFFFu)*(b>>16), _y = (a>>16)*(b&0xFFFFu); \\
	l += (a>>16)*(b>>16)+(_x>>16)+(_y>>16)-uint(int((_r>>16)-(_x&0xFFFFu)-(_y&0xFFFFu))>>16); \\
	r += _r; \\
	l += uint(r < _r); \\
}
void multiply(inout big a, big b){
	uint _carryl = 0u, _carryr = 0u;
	uint _;
	mult(a[1], b[P - 1], _carryr, _);
	for(int _i = P - 2; _i > 0; _i--){
		uint _cl = 0u;
		mult(a[P - _i], b[_i], _cl, _);
		_carryr += _cl;
		_carryl += uint(_carryr < _cl);
	}
	uint carry2l = 0u, carry2r = 0u;
	for(int _i = P - 1;_i > 0;_i--){
		uint _cr = _carryr;
		_carryr = _carryl; _carryl = 0u;
		for(int _j = _i - 1; _j > 0; _j--){
			uint _cl = 0u;
			mult(a[_j], b[_i - _j], _cl, _cr);
			_carryr += _cl;
			_carryl += uint(_carryr < _cl);
		}
		uint _c2l = 0u, _c2r = carry2r;
		carry2r = carry2l; carry2l = uint(int(carry2r) >> 31);
		mult(b[0], a[_i], _c2l, _c2r);
		_c2l -= a[_i]&-uint(b[0] >= 2147483648u);
		carry2r += _c2l;
		carry2l += uint(carry2r < _c2l) - uint(_c2l >= 2147483648u);
		_c2l = 0u;
		mult(a[0], b[_i], _c2l, _c2r);
		_c2l -= b[_i]&-uint(a[0] >= 2147483648u);
		carry2r += _c2l;
		carry2l += uint(carry2r < _c2l) - uint(_c2l >= 2147483648u);
		_c2l = 0u;
		_cr += _c2r;
		_ = uint(_cr < _c2r); _carryr += _;
		_carryl += uint(_carryr==0u)&_;
		a[_i] = _cr;
	}
	a[0] = a[0] * b[0] + _carryr + carry2r;
}

void add(inout big a, big b){
	uint _carry = 0u;
	for(int _i = P - 1;_i > 0;_i--){
		a[_i] += b[_i] - _carry;
		_carry ^= -uint((_carry^a[_i]) < (_carry^b[_i]));
	}
	a[0] += b[0] - _carry;
}
void addw(inout big a, big b, uint w){
	uint _carry = 0u;
	uint _h, _l;
	mult(b[P-1], w, _h, _l);
	for(int _i = P - 1;_i > 1;_i--){
		a[_i] += _h;
		_carry ^= -uint((_carry^a[_i]) < (_carry^_h));
		mult(b[_i-1], w, _h, _l);
		a[_i] += _l - _carry;
		_carry ^= -uint((_carry^a[_i]) < (_carry^_l));
	}
	a[1] += _h;
	_carry ^= -uint((_carry^a[1]) < (_carry^_h));
	mult(b[0], w, _h, _l);
	_h = uint(int(_h << 16) >> 16);
	a[1] += _l - _carry;
	_carry ^= -uint((_carry^a[1]) < (_carry^_l));
	a[0] += _h - _carry;
}
void addc(inout big a, float b){
	uint _c = uint(fract(b) * 4294967296.);
	a[1] += _c;
	a[0] += uint(int(floor(b))) + uint((a[1] < _c));
}
void lshift(inout big a, int k){
	for(int _i = 0; _i < P - 1; _i++)
		a[_i] = (a[_i] << k) | (a[_i + 1] >> (32-k));
	a[P-1] <<= k;
}
void take(inout big a, big b){
	uint _c = 0u;
	for(int _i = P - 1;_i > 0;_i--){
		a[_i] -= b[_i] - _c;
		_c ^= -uint((_c^a[_i]) > (_c^~b[_i]));
	}
	a[0] -= b[0] - _c;
}
void neg(inout big a){
	uint _o = 1u;
	for(int _i = P - 1; _i >= 0; _i--) _o &= uint((a[_i] = ~a[_i] + _o)==0u);
}
#define absolute(a) if(a[0] >= 2147483648u) neg(a)
void setc(out big a, float b){
	a[0] = uint(int(floor(b)));
	a[1] = uint(mod(b,1.) * 4294967296.);
	for(int i = 2; i < P; i++) a[i] = 0u;
}
${USE_BLOCK?`uniform Pos{ uvec4 x[${P+3>>2}]; uvec4 y[${P+3>>2}]; };`:`uniform uvec4 x[${P+3>>2}]; uniform uvec4 y[${P+3>>2}];`}
uniform vec2 p;
uniform uint steps;
big r, i;

float Mandelbrot(){
	big zr = r, zi = i;
	addc(zr, p.x); addc(zi, p.y);
	for(uint j = 0u;j < steps; j++){
		Check(j, zr, zi, 2., 2.);
		big t = zi;
		lshift(zi, 1);
		multiply(zi, zr);
		take(zr, t);
		lshift(t, 1);
		add(t, zr);
		multiply(zr, t);
		add(zr, r);
		add(zi, i);
	}
	return float(steps);
}
float Julia(){
	big t;
	for(uint j = 0u;j < steps; j++){
		Check(j, r, i, 2., 2.);
		t = i;
		lshift(i, 1);
		multiply(i, r);
		take(r, t);
		lshift(t, 1);
		add(t, r);
		multiply(r, t);
		addc(r, p.x);
		addc(i, p.y);
	}
	return float(steps);
}

float Mandelbrot3(){
	big zr = r, zi = i;
	addc(zr, p.x); addc(zi, p.y);
	for(uint j = 0u;j < steps; j++){
		Check(j, zr, zi, 2., 3.);
		big sr = zr, si = zi;
		multiply(sr, sr); multiply(si, si);
		big t = sr;
		lshift(t, 1); add(t, sr);
		take(t, si);
		multiply(zi, t);
		t = si; lshift(t, 1);
		add(t, si);
		take(sr, t);
		multiply(zr, sr);
		add(zr, r);
		add(zi, i);
	}
	return float(steps);
}
float Julia3(){
	for(uint j = 0u;j < steps; j++){
		Check(j, r, i, 2., 3.);
		big sr = r, si = i;
		multiply(sr, sr); multiply(si, si);
		big t = sr;
		lshift(t, 1); add(t, sr);
		take(t, si);
		multiply(i, t);
		t = si; lshift(t, 1);
		add(t, si);
		take(sr, t);
		multiply(r, sr);
		addc(r, p.x);
		addc(i, p.y);
	}
	return float(steps);
}

float BurningShip(){
	big zr, zi;
	setc(zr, p.x); setc(zi, p.y);
	for(uint j = 0u;j < steps; j++){
		Check(j, zr, zi, 2., 2.);
		big t = zi;
		lshift(zi, 1);
		multiply(zi, zr);
		absolute(zi);
		take(zr, t);
		lshift(t, 1);
		add(t, zr);
		multiply(zr, t);
		add(zr, r);
		add(zi, i);
	}
	return float(steps);
}

float BurningJulia(){
	big zr = r, zi = i;
	for(uint j = 0u;j < steps; j++){
		Check(j, zr, zi, 2., 2.);
		big t = zi;
		lshift(zi, 1);
		multiply(zi, zr);
		absolute(zi);
		take(zr, t);
		lshift(t, 1);
		add(t, zr);
		multiply(zr, t);
		addc(zr, p.x);
		addc(zi, p.y);
	}
	return float(steps);
}

float Celtic(){
	big zr, zi;
	setc(zr, p.x); setc(zi, p.y);
	for(uint j = 0u;j < steps; j++){
		Check(j, zr, zi, 2., 2.);
		big t = zi;
		lshift(zi, 1);
		multiply(zi, zr);
		take(zr, t);
		lshift(t, 1);
		add(t, zr);
		multiply(zr, t);
		absolute(zr);
		add(zr, r);
		add(zi, i);
	}
	return float(steps);
}

float CelticJulia(){
	big zr = r, zi = i;
	for(uint j = 0u;j < steps; j++){
		Check(j, zr, zi, 2., 2.);
		big t = zi;
		lshift(zi, 1);
		multiply(zi, zr);
		take(zr, t);
		lshift(t, 1);
		add(t, zr);
		multiply(zr, t);
		absolute(zr);
		addc(zr, p.x);
		addc(zi, p.y);
	}
	return float(steps);
}

uniform uint z;
out ${floatExt?'float':'uint'} ret;
void main(){
	for(int j = 0; j < ${P>>2}; j++){
		r[j<<2] = x[j].x, r[j<<2|1] = x[j].y, r[j<<2|2] = x[j].z, r[j<<2|3] = x[j].w;
		i[j<<2] = y[j].x, i[j<<2|1] = y[j].y, i[j<<2|2] = y[j].z, i[j<<2|3] = y[j].w;
	}
	${P&2?`r[${P&~3}]=x[${P>>2}].x;i[${P&~3}]=y[${P>>2}].x;r[${P&~3|1}]=x[${P>>2}].y;i[${P&~3|1}]=y[${P>>2}].y;`+(P&1?`r[${P-1}]=x[${P>>2}].z;i[${P-1}]=y[${P>>2}].z;`:''):(P&1?`r[${P-1}]=x[${P>>2}].x;i[${P-1}]=y[${P>>2}].x;`:'')}
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
	ret = ${floatExt?'':'floatBitsToUint'}(${fractal.value}());
}`)
	gl.attachShader(p1, fragmentShader)
	gl.linkProgram(p1)
	if (!gl.getProgramParameter(p1, gl.LINK_STATUS))
		throw new Error("Unable to initialize the shader p1: " + gl.getProgramInfoLog(p1))
	gl.useProgram(p1)
	let arr
	let BLOCK_SPLIT
	if(USE_BLOCK){
		BLOCK_SPLIT = P+3&~3
		const ubo = gl.createBuffer()
		gl.bindBuffer(gl.UNIFORM_BUFFER, ubo)
		gl.bufferData(gl.UNIFORM_BUFFER, BLOCK_SPLIT<<3, gl.DYNAMIC_DRAW)
		gl.bindBufferBase(gl.UNIFORM_BUFFER, 0, ubo)
		gl.uniformBlockBinding(p1, gl.getUniformBlockIndex(p1, 'Pos'), 0)
		arr = new Uint32Array(P*8)
	}
	console.timeEnd('compile')
	let uniX, uniY
	if(!USE_BLOCK){
		uniX = gl.getUniformLocation(p1, "x")
		uniY = gl.getUniformLocation(p1, "y")
	}
	const uniP = gl.getUniformLocation(p1, "p")
	const uniZ = gl.getUniformLocation(p1, "z")
	const uniSteps = gl.getUniformLocation(p1, "steps")
	const f = (x, y, z, steps = 100, px=0, py=0, pw=WIDTH, ph=HEIGHT) => {
		gl.useProgram(p1)
		gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, fb)
		gl.viewport(px, py, pw, ph)
		if(USE_BLOCK){
			for(let i = 0; i < P; i++){
				arr[i] = x[i]
				arr[BLOCK_SPLIT+i] = y[i]
			}
			gl.bufferData(gl.UNIFORM_BUFFER, arr, gl.DYNAMIC_DRAW)
		}else{
			gl.uniform1uiv(uniX, x)
			gl.uniform1uiv(uniY, y)
		}
		gl.uniform2f(uniP, +r.value, +i.value)
		gl.uniform1ui(uniZ, z)
		gl.uniform1ui(uniSteps, steps)
		gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4)
	}
	f.clear = () => {
		gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, fb)
		gl.viewport(0, 0, WIDTH, HEIGHT)
		gl.clearColor(Infinity, 0, 0, 0)
		gl.clear(gl.COLOR_BUFFER_BIT)
	}
	return f
}

const PALETTES = {
	Rainbow: 6,
	BlueGold: 4,
	EightColor: 12,
	Ocean: 4,
	Grayscale: 2,
	Burning: 6,
	StripedRainbow: 96
}
const p2 = gl.createProgram()
gl.attachShader(p2, vertexShader)
gl.attachShader(p2, makeShader(gl.FRAGMENT_SHADER, `#version 300 es
#line 381
precision mediump float; precision highp int;
uniform ${floatExt?'sampler2D':'usampler2D'} tex;
uniform float steps;

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
	a = mod(a, 6.);
	float b = 0., c = 0.;
	if(a > 4.){
		c = 1. - abs(a-5.);
		a = 0.; c *= c;
	}else if(a>2.){
		b = 1. - abs(a-3.);
		a = 0.;
 	}else if(a > 1.) a = 2. - a;
	return vec3(a+b+c,a+b*b+c*.25,a);
}

vec3 BlueGold(float a){
	a = mod(a*.5+1.,2.);
	#define gold(x) a<.5?vec3(1.,1.-1.2*a*a,1.-a*2.):vec3(2.-a*2.,(1.-a)*(1.-a)*2.8,0)
	if(a >= 1.){ a -= 1.; return 1.-(gold(a)); }
	else return gold(a);
}

vec3 EightColor(float a){
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

vec3 StripedRainbow(float a){
	vec3 c = Rainbow(a/16.);
	a = mod(a, 4.);
	return mix(vec3(a>2.), c, abs(a-float(a>2.)*2.-1.));
}

out vec4 col;
uniform int palette;
in vec2 uv;
uniform vec3 bounds;
uniform vec2 gradient;
void main(){
float f = ${floatExt?'':'uintBitsToFloat'}(texture(tex, vec2(uv.x,1.-uv.y)*bounds.z+bounds.xy).x);
float fade = steps-1.-f;
f = sqrt(max(0.,f)) * gradient.x + gradient.y;
switch(palette){${Object.keys(PALETTES).map((a,i)=>'case '+i+': col = vec4('+a+'(f),1.); break;').join('')}}
if(fade < 1.){ col.rgb *= fade; }
}`))
gl.linkProgram(p2)
gl.useProgram(p2)
const uniGradient = gl.getUniformLocation(p2, "gradient"), paletteUni = gl.getUniformLocation(p2, "palette")
const boundsUni = gl.getUniformLocation(p2, "bounds"), uniSteps2 = gl.getUniformLocation(p2, "steps")
let luSteps = -1
function drawToMain(){
	gl.useProgram(p2)
	gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, null)
	gl.viewport(0, 0, gl.canvas.width, gl.canvas.height)
	gl.uniform3f(boundsUni, rx/WIDTH, ry/HEIGHT, 1/rz)
	if(luSteps != steps)
		gl.uniform1f(uniSteps2, steps)
	gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4)
	stats.textContent = getStats()
}

let v = mode.value = 0, modeLengths = []
for(const k in PALETTES){
	if(!mode.value) mode.value = k
	const o = document.createElement('option')
	o.value = v++
	o.textContent = k
	modeLengths.push(PALETTES[k])
	mode.append(o)
}
function setGradients(){
	gl.uniform1i(paletteUni, +mode.value)
	gl.uniform2f(uniGradient, 0.5 ** gradient.value, gradient2.value * modeLengths[+mode.value])
}
mode.onchange = gradient.oninput = gradient2.oninput = () => { setGradients(); drawToMain() }
setGradients()
for(const k of ['Mandelbrot', 'Mandelbrot3', 'BurningShip', 'Celtic', 'Julia', 'Julia3', 'BurningJulia', 'CelticJulia']){
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
let rx = 0, ry = 0, rz = 1.05
let P = 2
function setprecision(P2 = P){
	P = Math.max(2, P2)
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
	shader = fractalShader(P)
}
const c2 = document.createElement('canvas').getContext('2d', {willReadFrequently: true})
let steps = z*2**slider.value
slider.onchange = e => {
	steps = Math.floor(z*2**slider.value)
	if(e){ mx = WIDTH / 2; my = HEIGHT / 2 }
	draw()
}
let adjWorstHang = 0, drawNum = 0
const done = (dt) => {
	info.textContent = dt >= 2000 ? (dt/1000).toFixed(2)+'s' : (dt).toFixed(1) + 'ms'
	rendering = false; lraf = 0
	console.log('done')
}
function draw(){
	//Clear buffer (optional)
	//gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT)
	const dn = ++drawNum
	let t0 = performance.now()
	if(z>P*32-36 && !lock) setprecision(P+1)
	else if(z<(P-3)*32 && !lock) setprecision(P-1)
	// Guarantee full utilization up to 4K shading units
	let divs = Math.min(32-Math.clz32(WIDTH*HEIGHT>>13), Math.max(0, Math.floor(Math.log2(adjWorstHang/100))))
	if(divs){
		if(divs < 4) divs = 4
		const px = mx/rz+rx, py = my/rz+ry
		const xDivs = 1<<(divs+1>>1), yDivs = 1<<(divs>>1)
		const chs = Array.from({length: xDivs*yDivs}, (_, i) => ({x: ((i&(xDivs-1))+.5)/xDivs*WIDTH, y: (Math.floor(i/xDivs)+.5)/yDivs*HEIGHT})).sort((a,b) => {const ax=a.x-px,ay=a.y-py,bx=b.x-px,by=b.y-py; return bx*bx+by*by-ax*ax-ay*ay})
		const rdx = .5/xDivs*WIDTH, rdy = .5/yDivs*HEIGHT
		let t0t = 0
		let fence = null
		let nAdjWorstHang = 0
		function pop(){
			if(dn != drawNum) return
			if(fence){
				const r = gl.clientWaitSync(fence, 0, 0)
				if(r == gl.TIMEOUT_EXPIRED) return lraf = requestAnimationFrame(pop)
				gl.deleteSync(fence)
				if(r != gl.CONDITION_SATISFIED && r != gl.ALREADY_SIGNALED) return // error
			}
			if(!chs.length){
				if(nAdjWorstHang < adjWorstHang)
					adjWorstHang = nAdjWorstHang
				return done(t0t)
			}
			lraf = requestAnimationFrame(pop)
			const dt = -(t0 - (t0 = performance.now()))
			done(t0t += dt)
			const hang = dt*xDivs*yDivs
			if(hang > nAdjWorstHang && dt>50) nAdjWorstHang = hang
			if(hang > adjWorstHang) adjWorstHang = hang
			if(chs.length < (xDivs*yDivs>>1) && chs.length > 2 && nAdjWorstHang < adjWorstHang)
				adjWorstHang = nAdjWorstHang
			const {x: xm, y: ym} = chs.pop()
			const x0 = Math.round(xm-rdx), x1 = Math.round(xm+rdx)
			const y0 = Math.round(ym-rdy), y1 = Math.round(ym+rdy)
			shader(x, y, z, steps, x0, y0, x1-x0, y1-y0)
			drawToMain()
			fence = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0)
		}
		shader.clear()
		pop()
		return
	}else shader(x, y, z, steps)
	drawToMain()
	let fence = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0)
	console.log('drawing')
	rendering = true
	lraf = requestAnimationFrame(function check(){
		if(dn != drawNum) return
		const r = gl.clientWaitSync(fence, 0, 0)
		console.log(r)
		if(r == gl.TIMEOUT_EXPIRED) return lraf = requestAnimationFrame(check)
		gl.deleteSync(fence)
		if(r != gl.CONDITION_SATISFIED && r != gl.ALREADY_SIGNALED) return // error
		done(adjWorstHang = performance.now() - t0)
	})
}
smooth.onchange = fractal.onchange = () => { setprecision(); draw() }
let rendering = false, zoomIn = false
function set(v, i, c = t){
	if(P > i) c[i] = Math.floor(v)
	if(P > i+1) c[i+1] = Math.floor(v * 4294967296)
	if(P > i+2) c[i+2] = Math.floor(v * 18446744073709551616)
	return c
}
function pos(a = false){
	if(rz >= 2 && zoomIn){
		//zoom in
		const padding = .5 - 1/rz
		add(x, shr(rx - WIDTH*padding/2, z))
		add(y, shr(ry - HEIGHT*padding/2, z))
		rz /= 2
		z++
		rx = WIDTH*padding; ry = HEIGHT*padding
		slider.onchange()
	}else if(rz < 1.2 && !zoomIn){
		//zoom out
		const padding = 1 - .5/rz
		add(x, shr(rx - WIDTH*padding, z))
		add(y, shr(ry - HEIGHT*padding, z))
		rz *= 2
		z--
		rx = WIDTH*padding/2
		ry = HEIGHT*padding/2
		slider.onchange()
	}else if(rx < 0 || ry < 0 || rx > WIDTH-WIDTH/rz || ry > HEIGHT-HEIGHT/rz){
		//pan
		const padding = .5 - .5/rz
		add(x, shr(rx - WIDTH*padding, z))
		add(y, shr(ry - HEIGHT*padding, z))
		rx = WIDTH*padding; ry = HEIGHT*padding
		draw()
	}else return drawToMain()
	zoomIn = false
}
let click = false, mx = 0, my = 0
let pxrt = devicePixelRatio
onresize = e => {
	WIDTH = Math.round(visualViewport.width*visualViewport.scale * pxrt)
	HEIGHT = Math.round(visualViewport.height*visualViewport.scale * pxrt)
	gl.canvas.width = innerWidth*devicePixelRatio
	gl.canvas.height = innerHeight*devicePixelRatio
	mx = WIDTH / 2; my = HEIGHT / 2
	if(!e){
		set(WIDTH * (-.5 / 2**z) - .6, 0, x)
		set(HEIGHT * (-.5 / 2**z), 0, y)
	}
	gl.texImage2D(gl.TEXTURE_2D, 0, floatExt?gl.R32F:gl.R32UI, WIDTH, HEIGHT, 0, gl.RED, floatExt?gl.FLOAT:gl.UNSIGNED_INT, null)
	draw()
}
setprecision(P)

let trz = NaN
function wheel(deltaY){
	if(rendering) return
	let d = Math.max(0.5, Math.min(2, 0.99 ** deltaY))
	d = Math.max(d, 2 ** (4+Math.log2(pxrt) - z) / rz)
	if(d>1) zoomIn = true
	if(Math.abs(deltaY) >= 100){
		if(trz != trz){
			trz = d
			let last = performance.now()
			requestAnimationFrame(function A(){
				const dt = Math.min(.5, (performance.now()-last)*.01); last = performance.now()
				let d = trz
				if(Math.abs(trz-1) > .001) d **= dt, trz /= d, requestAnimationFrame(A)
				else trz = NaN
				if(d>1) zoomIn = true
				rz *= d
				rx += mx * (d - 1) / rz
				ry += my * (d - 1) / rz
				pos()
			})
		}else trz *= d
		return
	}
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
	const exp = (z - Math.log2(canvas.height) + 1) / 3.321928094887362 + Math.log10(rz)
	return `r: ${xStr}\ni: ${yStr}\nzoom: ${(10**((exp%1+1)%1)).toFixed(2)}x10^${Math.floor(exp)}\nprecision: ${P*32} bits\niter: ${steps}`
}
stats.onclick = () => navigator.clipboard.writeText(getStats())

addEventListener('wheel', e => void(e.preventDefault(), wheel(e.deltaY)),{passive:false})

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
	let last = performance.now()/30
	mx = WIDTH/2
	my = HEIGHT/2
	requestAnimationFrame(function A(){
		if(!isAuto) return
		requestAnimationFrame(A)
		wheel(last-(last=performance.now()/30))
	})
}

const a = document.createElement('a')
save.onclick = () => { drawToMain(); gl.canvas.toBlob(blob => {
	a.href = URL.createObjectURL(blob)
	a.download = 'fractal'
	a.click()
	draw()
}) }
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
supersample.onchange = e => {
	const gain = Math.round(supersample.value-Math.log2(pxrt/devicePixelRatio))
	z += gain; rx *= 2**gain; ry *= 2**gain
	adjWorstHang *= 4**gain
	pxrt = 2**supersample.value*devicePixelRatio
	onresize(e)
}