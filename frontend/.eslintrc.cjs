module.exports = {
  root: true,

   env: {
    browser: true,//to run it on the browser
    es2020: true, //to use morden javascripts, so no errors on import and export
    node: true,//to allow all the node stuff in the project
  },

  extends: [
    'eslint:recommended',
    'plugin:react/recommended',
  ],

  //to allow the import and export of these react classes
  parserOptions: {
    sourceType: 'module',
  },

  

  plugins: ['react'],//this plugin in order to allow the react on top to work
};