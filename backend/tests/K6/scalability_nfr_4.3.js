import http from "k6/http";
import { check } from "k6";

export const options = {
    scenarios: {
        baseline: {
            executor: "constant-vus",
            vus: 50,
            duration: "30s",
            tags: { load: "baseline"}
        },

        highload: {
            executor: "constant-vus",
            vus: 150,
            duration: "30s",
            startTime: "35s",
            tags: { load: "high"}
        }
    },


    thresholds: {
        "http_req_duration{load:baseline}": ["p(85)<500"],
        "http_req_duration{load:high}": ["p(85)<550"],
        http_req_failed: ["rate<0.01"]
    }
}

export default function () {
  const response = http.get("https://api.equitylens.co.za/health");

  check(response, {"status is 200": (r) => r.status === 200,})
}

