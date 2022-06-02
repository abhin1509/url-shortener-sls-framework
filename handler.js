const AWS = require("aws-sdk");
const validUrl = require("valid-url");
const { customAlphabet } = require("nanoid");
const dynamoDB = new AWS.DynamoDB.DocumentClient();

const nanoid = customAlphabet(
  "1234567890abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVXYZ",
  5
);
const idLength = 4;
const redirectToWrongUrl =
  "https://www.meme-arsenal.com/memes/c9e6371faa3b57eaee1d35595ca8e910.jpg";

const sendResponse = (code, bool, msg, link) => {
  return {
    statusCode: code,
    body: JSON.stringify({
      success: bool,
      message: msg,
      items: link,
    }),
  };
};

const createUrl = async (uniqueId, longUrl) => {
  await dynamoDB
    .put({
      Item: { uniqueId, longUrl },
      TableName: "shortUrlTable-sls",
    })
    .promise();
  const params = {
    uniqueId,
    longUrl,
    shortUrl: `https://7l3y958ttf.execute-api.us-east-1.amazonaws.com/dev/api/${uniqueId}`,
  };
  return sendResponse(201, true, "Url created successfully", params);
};

const getLongUrl = async (uniqueId) => {
  const res = await dynamoDB
    .get({
      TableName: "shortUrlTable-sls",
      Key: { uniqueId },
    })
    .promise();
  if (Object.keys(res).length === 0) {
    return redirectToWrongUrl;
  }
  return res.Item.longUrl;
};

const checkAvailability = async (longUrl) => {
  const res = await dynamoDB
    .scan({
      TableName: "shortUrlTable-sls",
    })
    .promise();
  console.log(res.Items.length);
  for (let i = 0; i < res.Items.length; i++) {
    if (res.Items[i].longUrl === longUrl) {
      const params = {
        uniqueId: res.Items[i].uniqueId,
        longUrl: res.Items[i].longUrl,
        shortUrl: `https://7l3y958ttf.execute-api.us-east-1.amazonaws.com/dev/api/${res.Items[i].uniqueId}`,
      };
      return params;
    }
  }
  return false;
};

module.exports.hello = async (event) => {
  try {
    if (event.httpMethod === "POST") {
      const { longUrl } = JSON.parse(event.body);
      if (!validUrl.isUri(longUrl)) {  // If not a valid longUrl
        return sendResponse(404, false, "invalid url", []);
      }
      const bools = await checkAvailability(longUrl);
      if (bools != false) { // redundancy
        return sendResponse(201, true, "Url already available", bools);
      }
      const uniqueId = nanoid(idLength);
      return createUrl(uniqueId, longUrl);
    }
    if (event.httpMethod === 'GET') {
      let { id } = event.pathParameters;
      const longUrl = await getLongUrl(id);
      const response = {
          statusCode: 301,
          headers: {
              Location: longUrl,
          }
      };
      return response;
  }
  
  } catch (error) {
    console.log(error);
  }
};