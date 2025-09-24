// Importa a biblioteca axios para fazer requisições HTTP
const axios = require('axios');

exports.handler = async (event) => {
    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, body: JSON.stringify({ error: 'Método não permitido' }) };
    }

    try {
        const data = JSON.parse(event.body);
        const { 
            name, email, cpf, phone, 
            cep, address, addressNumber, complement, bairro
        } = data;

        // Validação dos dados essenciais
        if (!name || !email || !cpf || !phone || !cep || !address || !addressNumber || !bairro) {
            return { statusCode: 400, body: JSON.stringify({ error: 'Todos os campos, exceto complemento, são obrigatórios.' }) };
        }
        
        const ASAAS_API_KEY = process.env.ASAAS_API_KEY;
        if (!ASAAS_API_KEY) {
             console.error("Chave da API do Asaas não configurada.");
             return { statusCode: 500, body: JSON.stringify({ error: 'Erro de configuração do servidor.' }) };
        }
        
        // Use a URL de produção ou sandbox conforme necessário
        const asaasApiUrl = 'https://www.asaas.com/api/v3'; 

        const customerPayload = { 
            name, 
            email, 
            cpfCnpj: cpf, 
            mobilePhone: phone, 
            postalCode: cep, 
            address, 
            addressNumber, 
            complement, 
            province: bairro // 'province' é o campo para Bairro no Asaas
        };

        // Lógica de "procurar e depois criar"
        let customerId;

        // Etapa 1: Procurar pelo cliente existente através do CPF
        const searchResponse = await axios.get(`${asaasApiUrl}/customers?cpfCnpj=${cpf}`, { 
            headers: { 'access_token': ASAAS_API_KEY }
        });

        if (searchResponse.data.data.length > 0) {
            // Etapa 2: Cliente encontrado, usar o seu ID e atualizar os dados
            customerId = searchResponse.data.data[0].id;
            await axios.post(`${asaasApiUrl}/customers/${customerId}`, customerPayload, { 
                headers: { 'access_token': ASAAS_API_KEY }
            });
            console.log(`Cliente existente atualizado: ${customerId}`);
        } else {
            // Etapa 3: Cliente não encontrado, criar um novo
            const customerResponse = await axios.post(`${asaasApiUrl}/customers`, customerPayload, { 
                headers: { 'access_token': ASAAS_API_KEY }
            });
            customerId = customerResponse.data.id;
            console.log(`Novo cliente criado: ${customerId}`);
        }
        
        return { 
            statusCode: 200, 
            body: JSON.stringify({ success: true, customerId: customerId }) 
        };

    } catch (error) {
        console.error('Erro ao criar ou atualizar cliente:', error.response ? error.response.data : error.message);
        
        let userMessage = 'Não foi possível realizar o cadastro. Tente novamente mais tarde.';

        if (error.response && error.response.data && error.response.data.errors) {
            const asaasError = error.response.data.errors[0].description.toLowerCase();
            if (asaasError.includes('cpf') || asaasError.includes('cnpj')) {
                userMessage = 'CPF inválido. Por favor, verifique o número digitado.';
            } else if (asaasError.includes('email')) {
                userMessage = 'E-mail inválido. Por favor, verifique o endereço digitado.';
            }
        }

        return {
            statusCode: 500,
            body: JSON.stringify({ error: userMessage }),
        };
    }
};
