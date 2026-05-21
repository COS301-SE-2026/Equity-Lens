module.exports = {
  root: true,
  ignorePatterns: ['dist/', 'coverage/', 'node_modules/'],

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

  settings: {
    react: {
      version: 'detect', // automatically detects installed React version
    },
  },

  rules: {
    // React 17+ does not require React in scope for JSX
    'react/react-in-jsx-scope': 'off',
    // PropTypes validation not required - project uses consistent prop patterns
    'react/prop-types': 'off',
  },
};
