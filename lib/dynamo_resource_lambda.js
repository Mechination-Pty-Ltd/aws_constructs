const ddb = require("@aws-sdk/client-dynamodb");
const ddbUtil = require("@aws-sdk/util-dynamodb");
const dynamo = new ddb.DynamoDBClient({});

const hashKey = (key) => Buffer.from(JSON.stringify(key), "utf8").toString("base64");

async function onCreate(evt) {
  const { TableName, Item, Key } = evt.ResourceProperties;

  const marshalledItem = ddbUtil.marshall({ ...Item, ...Key });
  console.log("Putting item", JSON.stringify(marshalledItem, null, 2));
  await dynamo.send(new ddb.PutItemCommand({ TableName, Item: marshalledItem }));
  return {
    PhysicalResourceId: hashKey(Key),
  };
}

async function onUpdate(evt) {
  // Update the item.
  onCreate(evt);
}

async function onDelete(evt) {
  const { TableName, Key } = evt.ResourceProperties;
  const marshalledKey = ddbUtil.marshall(Key);
  console.log("Deleting item", JSON.stringify(marshalledKey, null, 2));
  await dynamo.send(new ddb.DeleteItemCommand({ TableName, Key: marshalledKey }));
}

exports.handler = async (event) => {
  console.log(event);
  switch (event.RequestType) {
    case "Create":
      return onCreate(event);
    case "Update":
      return onUpdate(event);
    case "Delete":
      return onDelete(event);
    default:
      throw new Error("Invlaid request type");
  }
};
