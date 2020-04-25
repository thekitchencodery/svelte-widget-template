import resolve from '@rollup/plugin-node-resolve';
import replace from '@rollup/plugin-replace';
import commonjs from '@rollup/plugin-commonjs';
import { terser } from 'rollup-plugin-terser';
import livereload from 'rollup-plugin-livereload';
import svelte from 'rollup-plugin-svelte';
import autoPreprocess from 'svelte-preprocess';
import pkg from './package.json';

const production = !process.env.ROLLUP_WATCH;

const name = pkg.name
	.replace(/^(@\S+\/)?(svelte-)?(\S+)/, '$3')
	.replace(/^\w/, (m) => m.toUpperCase())
	.replace(/-\w/g, (m) => m[1].toUpperCase()).trim();

	console.log(name);

export default {
	input: pkg.svelte,
	output: [
				{
					file: production ? pkg.module : `public/bundle.mjs`,
					format: 'es',
					sourcemap: true,
				},
				{
					file: production ? pkg.main : `public/bundle.js`,
					format: 'umd',
					sourcemap: true,
					name,
				}
		  ],
	plugins: [
		replace({
			"process.env.NODE_ENV": process.env.NODE_ENV
		}),
		svelte({
			// enable run-time checks when not in production
			dev: !production,
			/* Uncomment the following to extract CSS to separate file */
			// css: (css) => {
			// 	production ? css.write(`dist/${name}.css`) : css.write('public/bundle.css');
			// },

			/**
			 * Auto preprocess supported languages with
			 * '<template>'/'external src files' support
			 **/
			preprocess: autoPreprocess({
				postcss: true,
				scss: { includePaths: ['src', 'node_modules'] },
			}),
		}),

		// If you have external dependencies installed from
		// npm, you'll most likely need these plugins. In
		// some cases you'll need additional configuration —
		// consult the documentation for details:
		// https://github.com/rollup/rollup-plugin-commonjs
		resolve({
			browser: true,
			dedupe: ['svelte', 'svelte/transition', 'svelte/internal'],
		}),
		commonjs({
			include: ['node_modules/**'],
		}),

		// In dev mode, call `npm run start` once
		// the bundle has been generated
		!production && serve(),

		// Watch the `public` directory and refresh the
		// browser on changes when not in production
		!production && livereload('public'),

		// If we're building for production (npm run build
		// instead of npm run dev), minify
		production && terser(),
	],
	watch: {
		clearScreen: false,
	},
};

function serve() {
	let started = false;

	return {
		writeBundle() {
			if (!started) {
				started = true;

				require('child_process').spawn(
					'npm',
					['run', 'start', '--', '--dev'],
					{
						stdio: ['ignore', 'inherit', 'inherit'],
						shell: true,
					}
				);
			}
		},
	};
}
