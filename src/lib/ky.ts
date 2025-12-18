import ky from "ky";

const kyInstance = ky.create({
  timeout: 30000, // 30 seconds timeout (increased for moderation operations)
  retry: {
    limit: 2,
    methods: ["patch", "put", "post"],
    statusCodes: [408, 413, 429, 500, 502, 503, 504],
  },
  parseJson: (text) =>
    JSON.parse(text, (key, value) => {
      if (key.endsWith("At")) return new Date(value);
      return value;
    }),
});

export default kyInstance;
