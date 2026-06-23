export default {
  ignore: {
    files: [".claude/**"],
    overrides: [
      {
        files: ["package.json"],
        rules: ["deslop/unused-dev-dependency"],
      },
    ],
  },
};
