package com.geonex.bankingcore.security;

import com.auth0.jwt.JWT;
import com.auth0.jwt.algorithms.Algorithm;
import com.auth0.jwt.interfaces.DecodedJWT;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.List;

/**
 * Validates the Supabase-issued JWT forwarded by the Node SSR layer and
 * pins the authenticated user id onto the X-User-Id header consumed by
 * controllers.
 */
@Component
public class JwtAuthFilter extends OncePerRequestFilter {

    @Value("${geonex.supabase.jwt-secret:}")
    private String jwtSecret;

    @Override
    protected void doFilterInternal(HttpServletRequest req,
                                    HttpServletResponse res,
                                    FilterChain chain) throws ServletException, IOException {
        String header = req.getHeader("Authorization");
        if (header != null && header.startsWith("Bearer ") && !jwtSecret.isBlank()) {
            try {
                String token = header.substring(7);
                DecodedJWT decoded = JWT.require(Algorithm.HMAC256(jwtSecret)).build().verify(token);
                String sub = decoded.getSubject();
                var auth = new UsernamePasswordAuthenticationToken(sub, null, List.of());
                SecurityContextHolder.getContext().setAuthentication(auth);
            } catch (Exception ignored) {
                // fall through — endpoint will reject unauthenticated calls
            }
        }
        chain.doFilter(req, res);
    }
}
