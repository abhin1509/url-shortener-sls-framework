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

const apiBaseUrl = process.env.API_URL;
const tableName = process.env.TABLE_NAME;

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

const createUrl = async (uniqueId, longUrl, ttl) => {
  await dynamoDB
    .put({
      Item: { uniqueId, longUrl, ttl },
      TableName: tableName,
    })
    .promise();
  const params = {
    uniqueId,
    longUrl,
    shortUrl: `${apiBaseUrl}/${uniqueId}`,
  };
  return sendResponse(201, true, "Url created successfully", params);
};

const getLongUrl = async (uniqueId) => {
  const res = await dynamoDB
    .get({
      TableName: tableName,
      Key: { uniqueId },
    })
    .promise();
  console.log("curr time :: ", Math.round(Date.now() / 1000));
  if (Object.keys(res).length === 0) {
    console.log("url do not exist");
    return redirectToWrongUrl;
  }
  console.log("Item time :: ", res.Item.ttl);
  if (res.Item.ttl <= (Date.now() / 1000)) {
    console.log("url expired");
    return redirectToWrongUrl;
  }
  return res.Item.longUrl;
};

const checkAvailability = async (longUrl) => {
  const res = await dynamoDB
    .scan({
      TableName: tableName,
    })
    .promise();
  console.log(res.Items.length);
  for (let i = 0; i < res.Items.length; i++) {
    if (res.Items[i].longUrl === longUrl) {
      const params = {
        uniqueId: res.Items[i].uniqueId,
        longUrl: res.Items[i].longUrl,
        shortUrl: `${apiBaseUrl}/${res.Items[i].uniqueId}`,
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
      // generating epoch time
      const ttl = (Math.round(Date.now() / 1000)) + 120; //60*2 mins
      console.log(ttl);
      return createUrl(uniqueId, longUrl, ttl);
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