const axios = require("axios");
const generateImage = async (prompt = "", width = 512, height = 512) => {
  const options = {
    method: "POST",
    url: "https://modelslab.com/api/v6/realtime/text2img",
    headers: {
      "Content-Type": "application/json",
    },
    data: {
      key: process.env.MODELSLAB_KEY,
      prompt: `ultra realistic close up portrait ((${prompt}))`,
      negative_prompt: "bad quality",
      width: width,
      height: height,
      safety_checker: false,
      seed: null,
      samples: 1,
      base64: false,
      webhook: null,
      track_id: null,
    },
  };
  try {
    const response = await axios(options);
    const data = response.data;

    return data;
  } catch (error) {
    console.error("Error:", error);
    return null;
  }
};

module.exports = {
  generateImage,
};
