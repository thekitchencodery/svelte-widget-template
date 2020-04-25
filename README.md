


# svelte-widget-template

This is project template for building embeddable widgets using Svelte3. 

# Getting started

Clone it with [degit](https://github.com/Rich-Harris/degit):

```bash
npx degit thekitchencodery/svelte-widget-template my-new-widget
cd my-new-widget
git init # Not required but a good idea
npm init # or yarn init
npm install # or yarn
```
Then...
* Replace this README with your own
* Update `public\index.html` with the name of your widget.
  * for example `my-super-widget` becomes `MySuperWidget`


Your widget's main entry point lives in `src/Main.svelte`. 

There are a couple of widgets in the `src/widgets` folder, `Modal.svelte` and `Sidebar.svelte`, which are wired up in the 'example' index.html
You can use these to scaffold your own widgets or remove them entirely.

### I only need to export a single widget
If you only want to export a single widget modify `src/index.js` :

    export { default as default } from './Main.svelte';

You can then access your widget directly:

    let widget = new MySuperWidget({
        target: ...
        props: ...
    });

## Developing

Simply run ...

`npm run dev`

Navigate to localhost:5000. You should see your app running. Edit a component file in src, save it, and the browser will refresh to show your changes.

Your code will be compiled into the `/public` folder and will not be minified.

By default, the server will only respond to requests from localhost. To allow connections from other computers, edit the `sirv` commands in package.json to include the option --host 0.0.0.0. 


## Consuming components

Your package.json has a `"svelte"` field pointing to `src/index.js`, which allows Svelte apps to import the source code directly, if they are using a bundler plugin like [rollup-plugin-svelte](https://github.com/sveltejs/rollup-plugin-svelte) or [svelte-loader](https://github.com/sveltejs/svelte-loader) (where [`resolve.mainFields`](https://webpack.js.org/configuration/resolve/#resolve-mainfields) in your webpack config includes `"svelte"`). **This is recommended.**

For everyone else, `npm run build` will bundle your component's source code into a plain JavaScript module (`dist/index.mjs`) and a UMD script (`dist/index.js`). This will happen automatically when you publish your component to npm, courtesy of the `prepublishOnly` hook in package.json.


## TODO

* [ ] Tidy up this readme
* [ ] Automate some of the setup work
* [ ] Test, test, test!


## Credits and inspiration
* The Official [sveltejs/component-template](https://github.com/sveltejs/component-template) by [@Rich-Harris](https://github.com/Rich-Harris)
* The Awesome [YogliB/svelte-component-template](https://github.com/YogliB/svelte-component-template) by [@YogliB](https://github.com/YogliB)
* The Beautiful [milligram](https://github.com/milligram/milligram) by [@cjpatoilo](https://github.com/cjpatoilo)