export async function initAccessArt() {
  const canvas = document.querySelector(".access-visual canvas");
  const gl = canvas?.getContext("webgl", { antialias: true });
  if (!gl) return;
  try {
    const sources = await Promise.all(
      ["vertex", "fragment"].map(async (name) => {
        const response = await fetch(`/shaders/${name}.glsl`);
        if (!response.ok) throw new Error("Unable to load background shader");
        return response.text();
      }),
    );
    const program = gl.createProgram();
    const shaders = sources.map((source, index) => {
      const shader = gl.createShader(
        index ? gl.FRAGMENT_SHADER : gl.VERTEX_SHADER,
      );
      gl.shaderSource(shader, source);
      gl.compileShader(shader);
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS))
        throw new Error(gl.getShaderInfoLog(shader));
      gl.attachShader(program, shader);
      return shader;
    });
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS))
      throw new Error(gl.getProgramInfoLog(program));
    shaders.forEach((shader) => gl.deleteShader(shader));
    gl.useProgram(program);
    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]),
      gl.STATIC_DRAW,
    );
    const position = gl.getAttribLocation(program, "position");
    gl.enableVertexAttribArray(position);
    gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);
    gl.uniform3fv(
      gl.getUniformLocation(program, "u_colors"),
      new Float32Array([
        20 / 255,
        59 / 255,
        45 / 255,
        35 / 255,
        138 / 255,
        98 / 255,
        66 / 255,
        234 / 255,
        171 / 255,
      ]),
    );
    gl.uniform1f(gl.getUniformLocation(program, "u_grain"), 0.35);
    const resolution = gl.getUniformLocation(program, "u_resolution"),
      time = gl.getUniformLocation(program, "u_time");
    const resize = () => {
      const scale = Math.min(devicePixelRatio, 1.5);
      canvas.width = canvas.clientWidth * scale;
      canvas.height = canvas.clientHeight * scale;
      gl.viewport(0, 0, canvas.width, canvas.height);
    };
    new ResizeObserver(resize).observe(canvas);
    resize();
    const motion = matchMedia("(prefers-reduced-motion: reduce)");
    function draw(timestamp) {
      if (!document.hidden) {
        gl.uniform2f(resolution, canvas.width, canvas.height);
        gl.uniform1f(time, timestamp * 0.0002);
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      }
      if (!motion.matches) requestAnimationFrame(draw);
    }
    requestAnimationFrame(draw);
  } catch (error) {
    console.warn("Decorative background unavailable:", error.message);
  }
}
