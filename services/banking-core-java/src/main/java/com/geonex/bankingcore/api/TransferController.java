package com.geonex.bankingcore.api;

import com.geonex.bankingcore.service.TransferService;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1")
@RequiredArgsConstructor
public class TransferController {

    private final TransferService transferService;

    public record TransferRequest(
            @NotNull UUID accountId,
            @NotNull @DecimalMin("0.01") BigDecimal amount,
            @NotBlank String currency,
            @NotBlank String beneficiaryName,
            @NotBlank String beneficiaryAccount,
            String description,
            String cityName,
            @NotBlank String riskLevel,
            @NotNull @Min(0) @Max(100) Integer riskScore
    ) {}

    public record TransferResponse(
            UUID transactionId,
            String status,
            BigDecimal newBalance
    ) {}

    @PostMapping("/transfers")
    public ResponseEntity<TransferResponse> createTransfer(
            @RequestHeader("X-User-Id") UUID userId,
            @Valid @RequestBody TransferRequest req
    ) {
        return ResponseEntity.ok(transferService.executeTransfer(userId, req));
    }

    @GetMapping("/health")
    public String health() {
        return "ok";
    }
}
