export default {
  ignore: {
    files: [".claude/**"],
    overrides: [
      {
        files: ["package.json"],
        rules: ["deslop/unused-dev-dependency"],
      },
      {
        // Route files intentionally co-locate small layout/error/pending
        // components (see typescript/project-structure.md).
        files: ["src/routes/**/*.tsx"],
        rules: ["react-doctor/no-multi-comp"],
      },
    ],
  },
};
