import http from "k6/http";
import { check } from "k6";

export const options = {

    vus: 50,
    duration: "30s",


    thresholds: {
        http_req_duration: ["p(95)<2000"],
        http_req_failed: ["rate<0.01"],
        checks: ["rate==1.0"]
    }
}

export default function () {
    const response = http.get("https://api.equitylens.co.za/health");

    check(response, { "status is 200": (r) => r.status === 200, })
}

