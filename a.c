typedef unsigned int u32; typedef unsigned long long u64;
typedef int i32; typedef long long i64;
typedef float f32; typedef double f64;
typedef char u1; typedef void u0;
#define mult(a, b) ((u64)(a)*(u64)(b))
#include <math.h>

u32 P;
f32 a;
u64 steps;
u1 smooth;
f32 p_r, p_i;

struct{ f32 r; f32 i; }* output;

void set_options(u32 _P, u1 _smooth, u64 _steps, f32 _p_r, f32 _p_i, void* _output){
	P = _P; smooth = _smooth; output = _output;
	steps = _steps; p_r = _p_r; p_i = _p_i;
}

u1 check(u32* tr, u32* ti, f32 L){
	f32 a = (f32)(i32)tr[0] + (f32)tr[1] / 4294967296.;
	f32 b = (f32)(i32)ti[0] + (f32)ti[1] / 4294967296.;
	a = a * a + b * b;
	return a > 16.*L*L;
}

void multiply(u32* a, u32* b) {
	u64 carry = 0;
	u32 _;
	carry = mult(a[1], b[P - 1]) >> 32;
	for(int i = P - 2; i > 0; i--)
		carry += mult(a[P - i], b[i]) >> 32;
	i64 carry2 = 0;
	for(int i = P - 1;i > 0;i--){
		u32 c = carry & 0xFFFFFFFF;
		carry >>= 32;
		for(int j = i - 1; j > 0; j--){
			c += mult(a[j], b[i - j]);
			carry += c >> 32;
		}
		i64 c2 = carry2 & 0xFFFFFFFF;
		carry2 >>= 32;
		c2 += mult(b[0], a[i]);
		if(b[0] >= 2147483648) c2 -= (u64)a[i] << 32;
		carry2 += ((u64)c2>>32) - ((u64)(c2 < 0)<<32);
		c2 &= 0xFFFFFFFF;
		c2 += mult(a[0], b[i]);
		if(a[0] >= 2147483648) c2 -= (u64)b[i] << 32;
		carry2 += ((u64)c2>>32) - ((u64)(c2 < 0)<<32);
		c += c2;
		carry += c < (u32)c2;
		a[i] = c;
	}
	a[0] = a[0] * b[0] + carry + carry2;
}

void add(u32* a, u32* b) {
	u32 carry = 0;
	for(int i = P - 1;i > 0;i--){
		u64 c = (u64)a[i] + (u64)b[i];
		a[i] = c; carry = c >> 32;
	}
	a[0] += b[0] + carry;
}
void addc(u32* a, f32 b){
	u64 c = remainderf(b,1.) * 4294967296. + a[1];
	a[1] = c;
	a[0] += (u32)floor(b) + (u32)(c>>32);
}
void dbl(u32* a){
	for(int i = 0; i < P - 1; i++)
		a[i] = (a[i] << 1) | (a[i + 1] >> 31);
	a[P-1] <<= 1;
}
void take(u32* a, u32* b){
	i32 carry = 0;
	for(int i = P - 1;i > 0;i--){
		u64 c = (u64)a[i] - (u64)b[i] + (u64)carry;
		a[i] = c; carry = c >> 32;
	}
	a[0] -= b[0] - carry;
}
void absolute(u32* a){
	if(a[0] < 2147483648u) return;
	a[P-1] = -a[P-1];
	u1 o = a[P-1] == 0;
	for(int i = P - 2;i >= 0;i--){
		if(o){
			a[i] = -a[i];
			o = a[i] == 0;
		}else{a[i] = ~a[i];}
	}
}
#define cons(a, b) a[0] = (u32)floor(b), a[1] = (u32)(remainderf(b,1.) * 4294967296.)

/*${USE_BLOCK?`uniform Pos{ big x, y; };`:`uniform big x, y;`}
uniform f32 p_r, p_i;
uniform u32 z;
uniform u32 steps;
uniform f32 gradient;
out vec4 fragColor;*/

void Mandelbrot(u32* r, u32* i){
	u32 tr[P], ti[P], t[P];
	cons(tr, p_r); cons(ti, p_i);
	for(u64 j = 0;j < steps; j++){
		check(tr, ti, 2.);
		/*Fast Complex Square Alg. (made by me, blob.kat@hotmail.com)*/
		for(u32 j = P-1; j >= 0; j--) t[j] = ti[j];
		dbl(ti);
		multiply(ti, tr);
		take(tr, t);
		dbl(t);
		add(t, tr);
		multiply(tr, t);
		add(tr, r);
		add(ti, i);
	}
}
void Julia(u32* r, u32* i){
	u32 tr[P], ti[P], t[P];
	for(u32 j = P-1; j >= 0; j--) tr[j] = r[j], ti[j] = i[j];
	for(u64 j = 0;j < steps; j++){
		check(tr, ti, 2.);
		/*Fast Complex Square Alg. (made by me, blob.kat@hotmail.com)*/
		for(u32 j = P-1; j >= 0; j--) t[j] = ti[j];
		dbl(ti);
		multiply(ti, tr);
		take(tr, t);
		dbl(t);
		add(t, tr);
		multiply(tr, t);
		addc(tr, p_r);
		addc(ti, p_i);
	}
}
void BurningShip(u32* r, u32* i){
	u32 tr[P], ti[P], t[P];
	cons(tr, p_r); cons(ti, p_i);
	for(u64 j = 0;j < steps; j++){
		check(tr, ti, 2.);
		/*Fast Complex Square Alg. (made by me, blob.kat@hotmail.com)*/
		for(u32 j = P-1; j >= 0; j--) t[j] = ti[j];
		dbl(ti);
		multiply(ti, tr);
		absolute(ti);
		take(tr, t);
		dbl(t);
		add(t, tr);
		multiply(tr, t);
		add(tr, r);
		add(ti, i);
	}
}