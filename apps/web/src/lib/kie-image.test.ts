import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import test from "node:test";
import {
  assertAllowedKieImageUrl,
  buildKieZImageRequest,
  detectKieImageContentType,
  extractKieCallbackTaskId,
  parseKieTaskRecord,
  verifyKieWebhookSignature,
} from "./kie-image.ts";

test("builds separate Z-Image request bodies for supported blog ratios", () => {
  assert.deepEqual(
    buildKieZImageRequest({
      prompt: "A cinematic game top-up editorial scene",
      aspectRatio: "16:9",
      callbackUrl: "https://eztopup.io/api/webhooks/kie/blog-images",
    }),
    {
      model: "z-image",
      callBackUrl: "https://eztopup.io/api/webhooks/kie/blog-images",
      input: {
        prompt: "A cinematic game top-up editorial scene",
        aspect_ratio: "16:9",
        nsfw_checker: true,
      },
    }
  );

  assert.equal(
    buildKieZImageRequest({
      prompt: "A mobile-readable voucher composition",
      aspectRatio: "4:3",
      callbackUrl: "https://eztopup.io/api/webhooks/kie/blog-images",
    }).input.aspect_ratio,
    "4:3"
  );
});

test("detects supported provider image formats when CDN headers are generic", () => {
  assert.equal(
    detectKieImageContentType(
      "application/octet-stream",
      Buffer.from([0xff, 0xd8, 0xff, 0xe0])
    ),
    "image/jpeg"
  );
  assert.equal(
    detectKieImageContentType(
      "",
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
    ),
    "image/png"
  );
  assert.equal(
    detectKieImageContentType("", Buffer.from("RIFF0000WEBP")),
    "image/webp"
  );
  assert.equal(detectKieImageContentType("text/html", Buffer.from("<html>")), null);
});

test("parses successful and failed unified Market task records", () => {
  const success = parseKieTaskRecord({
    code: 200,
    msg: "success",
    data: {
      taskId: "task_z-image_123",
      state: "success",
      resultJson:
        '{"resultUrls":["https://tempfile.aiquickdraw.com/generated/a.png"]}',
      progress: 100,
    },
  });

  assert.equal(success.taskId, "task_z-image_123");
  assert.equal(success.state, "success");
  assert.equal(
    success.resultUrl,
    "https://tempfile.aiquickdraw.com/generated/a.png"
  );

  const failed = parseKieTaskRecord({
    data: {
      taskId: "task_z-image_456",
      state: "fail",
      failMsg: "Content rejected",
    },
  });
  assert.equal(failed.state, "fail");
  assert.equal(failed.error, "Content rejected");
});

test("extracts task IDs from callback payload variants", () => {
  assert.equal(extractKieCallbackTaskId({ taskId: "task_direct" }), "task_direct");
  assert.equal(
    extractKieCallbackTaskId({ data: { taskId: "task_nested" } }),
    "task_nested"
  );
  assert.equal(extractKieCallbackTaskId({ task_id: "task_snake" }), "task_snake");
});

test("verifies KIE HMAC in constant-time format and rejects stale timestamps", () => {
  const taskId = "task_z-image_123";
  const timestamp = "1785361200";
  const key = "a-test-webhook-hmac-key";
  const signature = createHmac("sha256", key)
    .update(`${taskId}.${timestamp}`)
    .digest("base64");

  assert.equal(
    verifyKieWebhookSignature({
      taskId,
      timestamp,
      signature,
      key,
      nowSeconds: 1785361220,
      toleranceSeconds: 300,
    }),
    true
  );
  assert.equal(
    verifyKieWebhookSignature({
      taskId,
      timestamp,
      signature,
      key,
      nowSeconds: 1785362000,
      toleranceSeconds: 300,
    }),
    false
  );
});

test("allows only HTTPS KIE output hosts and blocks lookalikes or private hosts", () => {
  assert.equal(
    assertAllowedKieImageUrl(
      "https://tempfile.aiquickdraw.com/generated/a.png",
      ["aiquickdraw.com"]
    ).hostname,
    "tempfile.aiquickdraw.com"
  );

  assert.throws(() =>
    assertAllowedKieImageUrl("http://tempfile.aiquickdraw.com/a.png", [
      "aiquickdraw.com",
    ])
  );
  assert.throws(() =>
    assertAllowedKieImageUrl("https://aiquickdraw.com.evil.example/a.png", [
      "aiquickdraw.com",
    ])
  );
  assert.throws(() =>
    assertAllowedKieImageUrl("https://127.0.0.1/private", ["127.0.0.1"])
  );
});
