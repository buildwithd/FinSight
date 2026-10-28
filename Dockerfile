FROM eclipse-temurin:17-jdk
WORKDIR /app
COPY FinSightServer.java index.html app.js styles.css README.md ./
RUN javac --add-modules jdk.httpserver -encoding UTF-8 FinSightServer.java
ENV PORT=10000
EXPOSE 10000
CMD ["java", "--add-modules", "jdk.httpserver", "FinSightServer"]
