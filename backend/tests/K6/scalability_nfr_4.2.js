import http from "k6/http";
import { check } from "k6";

export const options = {

    vus: 50,
    duration: "30s",


    thresholds: {
        checks: ["rate==0.1"]
    }
}

export default function () {
    const response = http.get("https://api.equitylens.co.za/health");

    check(response, { "status is 200": (r) => r.status === 200, })
}

