module.exports = {
  parser: "babel-eslint",
  plugins: ["react", "prettier", "standard", "react-hooks"],
  extends: ["standard", "plugin:react/recommended", "prettier"],
  env: { node: true, es6: true, browser: true },
  rules: {
    "prettier/prettier": "error",
    "standard/no-callback-literal": "off",
    camelcase: "off",
  },
  settings: {
    react: {
      version: "detect"
    }
  },
  parserOptions: {
    "ecmaVersion": 7,
    "sourceType": "module"
  }
}
