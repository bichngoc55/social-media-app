import ky from "ky";

const kyInstance = ky.create({
  timeout: 10000, // 10 seconds timeout
  parseJson: (text) =>
    JSON.parse(text, (key, value) => {
      if (key.endsWith("At")) return new Date(value);
      return value;
    }),
});

export default kyInstance;
