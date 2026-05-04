package com.geonex.bankingcore;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

/**
 * GEONEX Banking Core — Java Spring Boot "System of Record".
 *
 * The TanStack/React frontend handles UX, auth, and AI risk scoring.
 * After a transfer is risk-approved (and OTP-verified for MEDIUM risk),
 * the Node server proxies the request to this service which performs the
 * authoritative atomic ledger movement inside a database transaction.
 */
@SpringBootApplication
public class BankingCoreApplication {
    public static void main(String[] args) {
        SpringApplication.run(BankingCoreApplication.class, args);
    }
}
