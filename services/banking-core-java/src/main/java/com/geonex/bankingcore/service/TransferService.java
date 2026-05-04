package com.geonex.bankingcore.service;

import com.geonex.bankingcore.api.TransferController.TransferRequest;
import com.geonex.bankingcore.api.TransferController.TransferResponse;
import com.geonex.bankingcore.domain.Account;
import com.geonex.bankingcore.domain.Transaction;
import com.geonex.bankingcore.repo.AccountRepository;
import com.geonex.bankingcore.repo.TransactionRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.http.HttpStatus;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.UUID;

/**
 * Authoritative ledger service. All money movement happens here inside a
 * single Spring-managed JDBC transaction so partial failures roll back.
 */
@Service
@RequiredArgsConstructor
public class TransferService {

    private final AccountRepository accountRepo;
    private final TransactionRepository txRepo;

    @Transactional
    public TransferResponse executeTransfer(UUID userId, TransferRequest req) {
        // Pessimistic lock — prevents double-spend under concurrent requests.
        Account account = accountRepo.findByIdForUpdate(req.accountId())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Account not found"));

        if (!account.getUserId().equals(userId)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Account does not belong to caller");
        }

        if (account.getBalance().compareTo(req.amount()) < 0) {
            throw new ResponseStatusException(HttpStatus.UNPROCESSABLE_ENTITY, "Insufficient funds");
        }

        if ("HIGH".equalsIgnoreCase(req.riskLevel())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Transfer blocked by risk engine");
        }

        BigDecimal newBalance = account.getBalance().subtract(req.amount());
        account.setBalance(newBalance);
        accountRepo.save(account);

        Transaction tx = new Transaction();
        tx.setId(UUID.randomUUID());
        tx.setUserId(userId);
        tx.setAccountId(account.getId());
        tx.setAmount(req.amount());
        tx.setCurrency(req.currency());
        tx.setTransactionType("transfer");
        tx.setStatus("completed");
        tx.setRiskLevel(req.riskLevel());
        tx.setRiskScore(req.riskScore());
        tx.setBeneficiaryName(req.beneficiaryName());
        tx.setBeneficiaryAccount(req.beneficiaryAccount());
        tx.setDescription(req.description());
        tx.setCityName(req.cityName());
        tx.setCreatedAt(OffsetDateTime.now());
        txRepo.save(tx);

        return new TransferResponse(tx.getId(), tx.getStatus(), newBalance);
    }
}
